import{test,expect} from '@playwright/test';
import { LoginPage } from '@pages/LoginPage';
import{createLogger} from '@utils/logger';
import { beforeEach } from 'node:test';


const log = createLogger('login.spec');
test.describe('TTACART-Login',()=>{
    let loginPage: LoginPage;

    test.beforeEach(async({page})=>{
        loginPage = new LoginPage(page);
        await test.step('Open TTA Cart Login Page',async()=>{
            log.info('Opening TTA Login Page');
            await loginPage.open();

        });


    });

    test('Login with valid credentials @P0',async ({page})=>{
        await test.step('Login as Standard User',async()=>{
            log.info('Logging as a Standard user');
            await loginPage.loginAs('standard_user','tta_secret');

        });
        await test.step('verify login form is no longer shown',async()=>{
            log.info('Asserting that login form is hidden after login');
            await expect(page.locator('[data-test="login-button"]')).toBeHidden();
        });


    });

});