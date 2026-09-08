// APIs Helper is a simple type of a class 
// which can help you to make a different type of HTTP
// GET, POST, PATCH,PUT, DELETE
// Generic Fn, which can used by any TestCase 

import{Page,APIRequestContext,APIResponse} from '@playwright/test';
export type ApiContext=Page|APIRequestContext;
export type HttpMethod='GET'|'POST'|'PATCH'|'PUT'|'DELETE';
//Request Modification
export interface ApiRequestOptions{
    url:string;
    method:HttpMethod;
    headers?:Record<string,string>;
    data?:Record<string,any>;
    params?:Record<string,string>;
    timeout?:number;
}
export interface retryOptions{
    condition:(response:APIResponse)=>Promise<boolean>|boolean
    pollingInterval?:number;
    retryCount?:number;
}

export class ApiHelper{
    private context:ApiContext;
    constructor(context:ApiContext){
        this.context=context;
    }
    /* Get request object from context*/
    private getRequest():APIRequestContext{
        if('request' in this.context){
            return this.context.request;
        }
        return this.context as APIRequestContext;
    }
    /*Build Full URL with query params*/

    private buildUrl(url:string,params?:Record<string,string>):string{
        if(!params) return url;
        const searchParams=new URLSearchParams(params);
        return `${url}?${searchParams.toString()}`;
    }
    /*Perform API request */
    async callApi(options:ApiRequestOptions):Promise<APIResponse>{
        const {url,method,headers,data,params,timeout}=options;
        const request=this.getRequest();
        const fullUrl=this.buildUrl(url,params);
        switch(method){
            case 'GET':
                return await request.get(fullUrl,{headers,timeout});
            case 'POST':
                return await request.post(fullUrl,{headers,data,timeout});
            case 'PATCH':
                return await request.patch(fullUrl,{headers,data,timeout});
            case 'PUT':
                return await request.put(fullUrl,{headers,data,timeout});
            case 'DELETE':
                return await request.delete(fullUrl,{headers,timeout});
                default:
                    throw new Error(`Unsupported HTTP method: ${method}`);
        }
    }
    async callApiWithRetry(options:ApiRequestOptions,retryOptions:retryOptions):Promise<APIResponse>{
        const { condition,pollingInterval=5000,retryCount=3}=retryOptions;
        let lastResponse:APIResponse|null=null;
        for(let attempt=0;attempt<=retryCount;attempt++){
            lastResponse=await this.callApi(options);
            if(await condition(lastResponse)){
                return lastResponse;
            }
            if(attempt<retryCount){
                await new Promise(resolve=>setTimeout(resolve,pollingInterval));
            }
        }
        return lastResponse!;
    }
    /* convenience methods for common HTTP methods */
    async get(url:string,options?:Omit<ApiRequestOptions,'url'|'method'>):Promise<APIResponse>{
        return await this.callApi({url,method:'GET',...options});
    }
    async post(url:string,options?:Omit<ApiRequestOptions,'url'|'method'>):Promise<APIResponse>{
        return await this.callApi({url,method:'POST',...options});
    }
    async put(url:string,options?:Omit<ApiRequestOptions,'url'|'method'>):Promise<APIResponse>{
        return await this.callApi({url,method:'PUT',...options});
    }   
    async patch(url:string,options?:Omit<ApiRequestOptions,'url'|'method'>):Promise<APIResponse>{
        return await this.callApi({url,method:'PATCH',...options});
    }
    async delete(url:string,options?:Omit<ApiRequestOptions,'url'|'method'>):Promise<APIResponse>{
        return await this.callApi({url,method:'DELETE',...options});
    }

    /*Parse JSON response and return the data */
    async parseJsonResponse(response:APIResponse):Promise<T>{
     return await response.json() as T;
    }

     /*check if the response status is in the 2xx range */
     isSuccess(response:APIResponse):boolean{
        const status=response.status();
        return status>=200 && status<300;
     }
     /*check if the response status is in the 4xx range */
     isFailureClient(response:APIResponse): boolean{
        const status=response.status(); 
        return status>=400 && status<500;

     }
    }


