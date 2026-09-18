/**
 * ttaFormatter — renders a Cucumber run into the TTA HTML report.
 *
 * This does not generate HTML itself. It maps each scenario into the same
 * `TestData` model the Playwright reporter builds and hands the finished run to
 * `CustomTTAReporter.renderExternalRun`, so both runners share one report
 * template, one RCA/flaky pipeline and one tta-report/ history.
 *
 * cucumber.js references the `.cjs` shim beside this file, not this module:
 * cucumber resolves formatters through native ESM, which cannot load a `.ts`
 * file. The shim registers ts-node and re-exports this class as its default.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import {
    Formatter,
    Status,
    formatterHelpers,
    type IFormatterOptions,
} from "@cucumber/cucumber";
import CustomTTAReporter, {
    type StepData,
    type SuiteStats,
    type TestData,
} from "@utils/CustomReporter";

const REPORT_DIR = "tta-report";
const SCREENSHOT_DIR = "screenshots";

/** Statuses that make cucumber exit non-zero, so they must not read as green. */
const FAILED_STATUSES: string[] = [Status.FAILED, Status.AMBIGUOUS, Status.UNDEFINED];

/** `Duration` fields are numbers in current @cucumber/messages, Longs in older ones. */
type Numeric = number | { toNumber(): number };

type TestCaseAttempt = ReturnType<
    InstanceType<typeof formatterHelpers.EventDataCollector>["getTestCaseAttempts"]
>[number];
type ParsedAttempt = ReturnType<typeof formatterHelpers.parseTestCaseAttempt>;
type ParsedStep = ParsedAttempt["testSteps"][number];
/** Narrower than `TestData["status"]` — a scenario is never "timedOut" here. */
type StepStatus = StepData["status"];

function toNumber(value: Numeric | undefined): number {
    if (value === undefined) return 0;
    return typeof value === "number" ? value : value.toNumber();
}

function durationToMs(duration?: { seconds?: Numeric; nanos?: Numeric }): number {
    if (!duration) return 0;
    return toNumber(duration.seconds) * 1000 + toNumber(duration.nanos) / 1e6;
}

function timestampToDate(timestamp?: { seconds?: Numeric; nanos?: Numeric }): Date {
    return new Date(durationToMs(timestamp));
}

/**
 * `tta-report/history.html` parses run ids with
 * `report_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.html`, so the id has to
 * stay in this exact shape or the run drops out of the history page.
 */
function formatRunId(date: Date): string {
    const pad = (value: number): string => String(value).padStart(2, "0");
    return (
        `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
        `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
    );
}

function toReportStatus(status: string): StepStatus {
    if (status === Status.PASSED) return "passed";
    if (FAILED_STATUSES.includes(status)) return "failed";
    return "skipped";
}

/** Attachments are base64 by default; IDENTITY means the body is already the bytes. */
function decodeAttachment(attachment: { body: string; contentEncoding: string }): Buffer {
    const encoding: string = attachment.contentEncoding;
    return Buffer.from(attachment.body, encoding === "BASE64" ? "base64" : "utf8");
}

export default class TtaFormatter extends Formatter {
    static readonly documentation =
        "Collects the Cucumber run and writes it to the TTA HTML report (tta-report/).";

    private readonly runId: string;
    private startTime: Date;
    private endTime: Date;

    constructor(options: IFormatterOptions) {
        super(options);

        const now = new Date();
        this.runId = formatRunId(now);
        this.startTime = now;
        this.endTime = now;

        // The run's own timestamps are more accurate than construction/finished
        // times, which would fold cucumber's startup into the reported duration.
        options.eventBroadcaster.on("envelope", (envelope) => {
            if (envelope?.testRunStarted?.timestamp) {
                this.startTime = timestampToDate(envelope.testRunStarted.timestamp);
            }
            if (envelope?.testRunFinished?.timestamp) {
                this.endTime = timestampToDate(envelope.testRunFinished.timestamp);
            }
        });
    }

    /** Awaited by cucumber's formatter cleanup, so the report can be async. */
    async finished(): Promise<void> {
        try {
            await this.writeReport();
        } catch (error) {
            // Reporting must never turn a green run red.
            const message = error instanceof Error ? error.message : String(error);
            this.log(`TTA formatter: could not write the report: ${message}\n`);
        }
        await super.finished();
    }

    private async writeReport(): Promise<void> {
        const attempts = this.eventDataCollector.getTestCaseAttempts();
        const flaky = attempts.filter((attempt) => attempt.willBeRetried).length;

        const tests: TestData[] = [];
        for (const attempt of attempts) {
            // A retried attempt is not the scenario's final result.
            if (attempt.willBeRetried) continue;
            tests.push(this.toTestData(attempt, tests.length));
        }

        const stats: SuiteStats = {
            total: tests.length,
            passed: tests.filter((test) => test.status === "passed").length,
            failed: tests.filter((test) => test.status === "failed").length,
            skipped: tests.filter((test) => test.status === "skipped").length,
            flaky,
        };

        const reporter = new CustomTTAReporter();
        const file = await reporter.renderExternalRun({
            runId: this.runId,
            startTime: this.startTime,
            endTime: this.endTime,
            tests,
            stats,
            meta: { browser: "chromium", workers: 1 },
        });

        this.log(
            `\nTTA report: ${file} (${stats.passed} passed, ${stats.failed} failed, ${stats.skipped} skipped)\n`,
        );
    }

    private toTestData(attempt: TestCaseAttempt, index: number): TestData {
        const parsed = formatterHelpers.parseTestCaseAttempt({
            testCaseAttempt: attempt,
            snippetBuilder: this.snippetBuilder,
            supportCodeLibrary: this.supportCodeLibrary,
        });

        const featureName = attempt.gherkinDocument.feature?.name ?? "(unnamed feature)";
        const uri = attempt.pickle.uri;
        const line = parsed.testCase.sourceLocation?.line ?? 0;

        const screenshots: { name: string; path: string }[] = [];
        const steps: StepData[] = [];
        let offsetMs = 0;

        for (const step of parsed.testSteps) {
            // Hook steps carry no `text`; only real gherkin steps are reported.
            if (step.text === undefined) continue;
            const stepData = this.toStepData({
                step,
                stepIndex: steps.length,
                testIndex: index,
                offsetMs,
                screenshots,
            });
            offsetMs += stepData.duration;
            steps.push(stepData);
        }

        const status = toReportStatus(attempt.worstTestStepResult.status);
        const message = attempt.worstTestStepResult.message;

        return {
            id: `test-${index}`,
            title: attempt.pickle.name,
            fullTitle: `${featureName} › ${attempt.pickle.name}`,
            file: uri,
            describePath: [featureName],
            location: `${path.basename(uri)}:${line}`,
            duration: steps.reduce((total, step) => total + step.duration, 0),
            status,
            retry: parsed.testCase.attempt,
            screenshots,
            steps,
            logs: [],
            error: status === "failed" ? message : undefined,
            tags: attempt.pickle.tags.map((tag) => tag.name),
        };
    }

    private toStepData(input: {
        step: ParsedStep;
        stepIndex: number;
        testIndex: number;
        offsetMs: number;
        screenshots: { name: string; path: string }[];
    }): StepData {
        const { step, stepIndex, testIndex, offsetMs, screenshots } = input;
        const status = toReportStatus(step.result.status);

        let screenshot: string | undefined;
        for (const attachment of step.attachments) {
            if (attachment.mediaType !== "image/png") continue;

            const file = `${this.runId}_${testIndex}_${stepIndex}.png`;
            const destination = path.join(REPORT_DIR, SCREENSHOT_DIR, file);
            fs.mkdirSync(path.dirname(destination), { recursive: true });
            fs.writeFileSync(destination, decodeAttachment(attachment));

            const relative = `${SCREENSHOT_DIR}/${file}`;
            screenshots.push({ name: attachment.fileName ?? `Step ${stepIndex + 1}`, path: relative });
            screenshot ??= relative;
        }

        return {
            title: `${step.keyword}${step.text ?? ""}`.trim(),
            category: "test.step",
            duration: durationToMs(step.result.duration),
            status,
            screenshot,
            error: status === "failed" ? step.result.message : undefined,
            startTime: new Date(this.startTime.getTime() + offsetMs).toLocaleTimeString(),
            stepIndex,
            videoStartTime: 0,
            videoEndTime: 0,
        };
    }
}
