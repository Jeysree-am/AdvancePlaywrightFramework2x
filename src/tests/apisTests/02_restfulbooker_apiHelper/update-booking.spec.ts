import{expect,test} from '@playwright/test';
import{ApiHelper} from '@utils/ApiHelper';

test.describe('Update Booking using API Helper',()=> {
    test('TC#2 Update Booking',async({request})=>{
        const api = new ApiHelper(request);
        //Token
       const authRes = await api.post('/auth', {data:{ username: 'admin', password: 'password123' }});
        const{token}= await api.parseJsonResponse(authRes) as {token:string};
        expect(token).toBeTruthy();
        //Create Booking to update
        const created =await api.post('/booking',{
            data:{
                firstname:'Before',
                lastname:'Update',
                totalprice:100,
                depositpaid:true,
                bookingdates:{  
                    checkin:'2026-10-01',
                    checkout:'2026-10-05',
                },
                additionalneeds:'Breakfast',
            }
        });
        const{bookingid}= await api.parseJsonResponse(created) as {bookingid:number};
        //Put with cookie header
        const response = await api.put(`/booking/${bookingid}`, {
            data: {
                firstname: 'After',
                lastname: 'Update',
                totalprice: 200,
                depositpaid: true,
                bookingdates: {
                    checkin: '2026-10-10',
                    checkout: '2026-10-15',
                },
                additionalneeds: 'Extra Bed',
            },
            headers: { cookie: `token=${token}` },
        });
        expect(api.isSuccess(response)).toBe(true);
         const updated = await api.parseJsonResponse(response) as {
            firstname: string;
            totalprice: number;
        };
        expect(updated.firstname).toBe('After');
        expect(updated.totalprice).toBe(200);
    });
});
    

