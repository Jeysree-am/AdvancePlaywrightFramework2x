import{expect,test} from '@playwright/test';
import{ApiHelper} from '@utils/ApiHelper';
import{createLogger} from '@utils/logger';




const log = createLogger('create-booking');

interface CreateBookingResponse{
    bookingid:number;
    booking:{
        firstname:string;
        lastname:string;
        totalprice:number;
        depositpaid:boolean;
        bookingdates:{
            checkin:string;
            checkout:string;
        };
        additionalneeds:string;
    };

}
test.describe('Create Booking using API Helper',()=> {
    test('TC#1 Create Booking',async({request},testInfo)=> {
        const api = new ApiHelper(request);
        const payload={
            firstname:'John',
            lastname:'Doe',
            totalprice:150, 
            depositpaid:true,
            bookingdates:{
                checkin:'2026-10-01',   
                checkout:'2026-10-05',
            },
            additionalneeds:'Breakfast',
        };
        let body:CreateBookingResponse;
        //Step1-Send the create request
        await test.step('Create Booking with payload',async()=>{
            log.info(`Step 1:create Booking for ${payload.firstname} ${payload.lastname} (price ${payload.totalprice})`);
            const response = await api.post('/booking',{data: payload});
            log.info(`Response status: ${response.status()} for create booking`);
            expect(api.isSuccess(response)).toBe(true);
            body = await api.parseJsonResponse(response) as CreateBookingResponse;
            //Attach the booking id to the test report
            await testInfo.attach('Create Booking Response', {
                body: JSON.stringify(body, null, 2),
                contentType: 'application/json',
            });
        });
        //Step 2-Verify the server echoed the payload correctly
        await test.step('Verify the server echoed the payload correctly',async()=>{
            log.info(`Step 2:Verify the server echoed the booking id ${body.bookingid} and payload correctly`);
            expect(body.bookingid).toBeGreaterThan(0);
            expect(body.booking.firstname).toBe(payload.firstname);
            expect(body.booking.lastname).toBe(payload.lastname);
            expect(body.booking.totalprice).toBe(payload.totalprice);
           log.info(`Step 2 is verified for ${body.bookingid} verfied OK`);
        });
    });
});






    