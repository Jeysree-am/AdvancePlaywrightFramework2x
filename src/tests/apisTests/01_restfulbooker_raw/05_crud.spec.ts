import{test,expect} from '@playwright/test';
import{logger} from '@utils/logger';

interface BookingDates{
    checkin:string;
    checkout:string;
}
interface BookingPayload{
    firstname:string;
    lastname:string;
    totalprice:number;
    depositpaid:boolean;
    bookingdates:BookingDates;
    additionalneeds:string;
}   
interface AuthtokenResponse{
    token:string;
}
interface CreateBookingResponse{
    bookingid:number;
    booking:BookingPayload;
}
interface BookingFlowState{
    token?:string;
    bookingId?:number;
}

    test.describe.serial('CRUD operations for Restful Booker API',()=>{
    const baseUrl = process.env.API_BASE_URL||'https://restful-booker.herokuapp.com/';
    const headers={
        Accept:'application/json',
        'Content-Type':'application/json',
    };
    const bookingFlowState:BookingFlowState={};
    const payload:BookingPayload={
        firstname:'James',
        lastname:'Brown',
        totalprice:111,
        depositpaid:true,
        bookingdates:{
            checkin:'2023-01-01',
            checkout:'2023-01-02'
        },
        additionalneeds:'Breakfast',
    };

    test('TC#1 @p0  Create Token',async({request})=>{
        await test.step('create token',async()=>{
            const responseData= await request.post(`${baseUrl}/auth`,{
                headers,
                data:{
                    username:'admin',
                    password:'password123'  
                },

                });
                expect(responseData.status()).toBe(200);
                const data:AuthtokenResponse= await responseData.json();
                expect(data.token).toBeTruthy();
                bookingFlowState.token=data.token;
                logger.info('Auth Token Created Successfully');
        });
    });

    test('TC#2 @p0-Create Booking',async({request})=>{
        await test.step('create booking',async()=>{
            const responseData= await request.post(`${baseUrl}/booking`,{
                headers,
                data:payload,
            });
            expect(responseData.status()).toBe(200);
            const data:CreateBookingResponse= await responseData.json();
            expect(data.bookingid).toBeTruthy();
            bookingFlowState.bookingId=data.bookingid;
            expect(data.booking.firstname).toBe(payload.firstname);
            expect(data.booking.lastname).toBe(payload.lastname);
            logger.info(`Booking Created Successfully with Booking Id: ${bookingFlowState.bookingId}`);

        });
    });

    test('TC#3 @p0-Update Booking',async({request})=>{
        await test.step('update booking',async()=>{
            const token=bookingFlowState.token;
            console.log(`Token: ${token}`);
            const bookingId=bookingFlowState.bookingId;
            // eslint-disable-next-line playwright/no-conditional-in-test -- guard the serial chain when an earlier step failed
            if(!token || !bookingId){
                throw new Error('Token or Booking ID is missing. Cannot proceed with update booking.');
            }
            const responseData= await request.put(`${baseUrl}/booking/${bookingId}`,{
                headers:{
                    ...headers,
                    cookie:`token=${token}`,
                },
                data:payload,   
                });
                expect(responseData.status()).toBe(200);
                const data:BookingPayload= await responseData.json();
                expect(data.firstname).toBe(payload.firstname);
                expect(data.lastname).toBe(payload.lastname);
                logger.info(`Updated Booking Id ${bookingId}:${data.firstname} ${data.lastname}`);
            });
        });
    });
        


