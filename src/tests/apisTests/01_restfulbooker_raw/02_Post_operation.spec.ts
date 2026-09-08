import {test,expect} from '@playwright/test';
import{logger} from '@utils/logger';
test('TC#1 @p0-POST: Verify that create booking is working fine',async({request})=>{
     const baseUrl = process.env.API_BASE_URL||'https://https://restful-booker.herokuapp.com/';
     const payload={
        firstname:'Jim',
        lastname:'Brown',
        totalprice:111,
        depositpaid:true,
        bookingdates:{
            checkin:'2026-10-20',
            checkout:'2026-10-22',
        },
        additionalneeds:'breakfast',

     };

     const headers= {
        Accept:'application/json',
        'Content-Type':'application/json',

     };
     const responseData= await request.post(`${baseUrl}/booking`,{
        headers,
        data:payload
     });
     expect (responseData.status()).toBe(200);
     const data = await responseData.json();
     expect(data.bookingid).toBeTruthy();
     expect(data.booking.firstname).toBe(payload.firstname);
     expect(data.booking.lastname).toBe(payload.lastname);
     logger.info(`Created Booking Id: ${data.bookingid}`);
}  );