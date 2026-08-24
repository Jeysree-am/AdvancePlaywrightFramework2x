// Whatever the common utilities are there, it will be present in the util element locator. 

/**
 * This is UtilElementLocators - Contains all the util we can reuse direclty
 * 
 **/
import{expect,Locator,Page} from '@playwright/test';
import { createLogger,type Logger } from '@utils/logger';

export const DEFAULT_ACTION_TIMEOUT_MS = 15_000;

/**
 * Flex - a selector can be a CSS string or an already-built Locator.
 *
 * The TTACart suite uses `data-test` attributes everywhere, so most call sites
 * pass either:
 *   - `'[data-test="username"]'`  (a CSS string), or
 *   - `page.getByTestId('username')` (a Locator object).
 */

export type Flex = string|Locator;

export class UtilElementLocator{
    private readonly page: Page;
    private readonly log: Logger;


    constructor(page:Page,scope:string='utilElementLocator'){
        this.page=page;
        this.log=createLogger(scope);
    }


       private  toLocator(target:Flex):Locator{

            return typeof target==='string'?this.page.locator(target):target;

        }

          /** Human-readable label for a target, used only in log lines. */
          private describe(target:Flex):string{
            return typeof target==='string'?target:target.toString();

          }

          //=================Mouse Actions==================

async click(target:Flex,timeout:number= DEFAULT_ACTION_TIMEOUT_MS):Promise<void>{
    const loc=this.toLocator(target);// Checking if it is a normal locator or a Playwright locator.
    this.log.debug(`click ${this.describe(target)}`);
    await loc.click({timeout});
   }

   async doubleclick(target:Flex,timeout:number=DEFAULT_ACTION_TIMEOUT_MS):Promise<void>{
    const loc=this.toLocator(target);
    this.log.debug(`Double Click ${this.describe(target)}`);
    await loc.dblclick({timeout});
   }
   async rightclick(target:Flex,timeout:number=DEFAULT_ACTION_TIMEOUT_MS):Promise<void>{
    const loc=this.toLocator(target);
    this.log.debug(`Right Click ${this.describe(target)}`);
    await loc.click({button:'right',timeout});
   }
   async hover(target:Flex,timeout:number=DEFAULT_ACTION_TIMEOUT_MS):Promise<void>{
    const loc = this.toLocator(target);
    await loc.hover({timeout});
   }

   //================Input Actons==================


   async fill(target:Flex,value:string,timeout:number=DEFAULT_ACTION_TIMEOUT_MS):Promise<void>{
    const loc =this.toLocator(target);
    this.log.debug(`Fill ${this.describe(target)}`);
    await loc.fill(value,{timeout});
   }
   async type(target:Flex,value:string,timeout:number=DEFAULT_ACTION_TIMEOUT_MS):Promise<void>{
    // Note: Playwright deprecated .type() in favour of .pressSequentially().
        // We keep the public method name so the API still reads naturally for
        // students used to the older verb.
   
    const loc =this.toLocator(target);
   await loc.pressSequentially(value,{timeout});
   }
   async clear(target:Flex,timeout:number=DEFAULT_ACTION_TIMEOUT_MS):Promise<void>{
    const loc= this.toLocator(target);
    await loc.clear({timeout});
   }
   async pressSequentially(target:Flex,value:string,timeout:number=DEFAULT_ACTION_TIMEOUT_MS):Promise<void>{
    const loc =this.toLocator(target);
   await loc.pressSequentially(value,{timeout});
   }

   //=============Text and content getters========
   async getText(target:Flex):Promise<string>{
    const loc = this.toLocator(target);
    const txt=(await loc.textContent())??'';
    return txt.trim();
   }

   async getInnerText(target:Flex):Promise<string>{
    const loc= this.toLocator(target);
    return (await loc.innerText()).trim();
   }


    async getAllTexts(target:Flex):Promise<string[]>{
        const loc =this.toLocator(target);
        const texts= await loc.allTextContents();
        return texts.map((t)=>t.trim());
    }

    async getAttr(target:Flex,name:string):Promise<string|null>{
        const loc=this.toLocator(target);
        return loc.getAttribute(name); 
    }
    async getValue(target:Flex):Promise<string>{
        const loc = this.toLocator(target);
        return loc.inputValue();
    }

    //==============Count=============
    async count(target:Flex):Promise<number>{
        const loc =this.toLocator(target);
        return loc.count();
    }

    //==============State Checks=============
    async isVisible(target:Flex):Promise<boolean>{
        const loc = this.toLocator(target);
        return loc.isVisible();
    }
     async isEnabled(target:Flex):Promise<boolean>{
        const loc= this.toLocator(target);
        return loc.isEnabled();
     }


     async isChecked(target:Flex):Promise<boolean>{
        const loc =this.toLocator(target);
        return loc.isChecked();
     }

     //===============Waits=================
     async waitForVisible(target:Flex,timeout:number = DEFAULT_ACTION_TIMEOUT_MS):Promise<void>{
        const loc =this.toLocator(target);
        await expect(loc).toBeVisible({timeout});
     }

     async waitForHidden(target:Flex,timeout:number = DEFAULT_ACTION_TIMEOUT_MS):Promise<void>{
        const loc= this.toLocator(target);
        await expect(loc).toBeHidden({timeout});
     }

     async waitForPageLoad():Promise<void>{
        this.log.debug('waitForpageLoad');
        await this.page.waitForLoadState('domcontentloaded');
        await this.page.waitForLoadState('networkidle').catch(()=>{
            // TTACart is static + localStorage so networkidle is fast,
            // but we swallow the rare timeout so the test isn't punished
            // by background analytics calls on the demo origin.
        });
     }

     //================Selects==================
     async selectByText(target:Flex,text:string):Promise<void>{
        const loc = this.toLocator(target);
        await loc.selectOption({label:text});
     }
     async selectByValue(target:Flex,value:string):Promise<void>{
        const loc =this.toLocator(target);
        await loc.selectOption({value});
     }

     async selectByIndex(target:Flex,index:number):Promise<void>{
        const loc =this.toLocator(target);
        await loc.selectOption({index});
     }

    }


  