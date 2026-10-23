import type {Product} from './model';
export const FREE_DEVICE_LIMIT=10;
export function productCatalog():Product[]{return[
 {id:'dev',name:'Free',description:'Free account for one personal workspace and up to 10 devices.',stripePriceId:'',monthlyPrice:0,serverLimit:FREE_DEVICE_LIMIT,active:true},
 {id:'starter',name:'Starter',description:'Detection and alerting with 25 devices included.',stripePriceId:process.env.STRIPE_STARTER_PRICE_ID??'',monthlyPrice:49,serverLimit:25,extraDeviceMonthlyPrice:2,active:true},
 {id:'scale',name:'Scale',description:'Expanded incident monitoring with 50 devices included.',stripePriceId:process.env.STRIPE_SCALE_PRICE_ID??'',monthlyPrice:99,serverLimit:50,extraDeviceMonthlyPrice:2,active:true},
];}
