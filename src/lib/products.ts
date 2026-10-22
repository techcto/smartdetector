import type {Product} from './model';
export const FREE_DEVICE_LIMIT=10;
export function productCatalog():Product[]{return[
 {id:'dev',name:'Free',description:'Free account for one personal workspace and up to 10 devices.',stripePriceId:'',monthlyPrice:0,serverLimit:FREE_DEVICE_LIMIT,active:true},
 {id:'starter',name:'Starter',description:'Detection and alerting for up to 5 devices.',stripePriceId:process.env.STRIPE_STARTER_PRICE_ID??'',monthlyPrice:49,serverLimit:5,active:true},
 {id:'scale',name:'Scale',description:'Expanded incident monitoring for up to 50 devices.',stripePriceId:process.env.STRIPE_SCALE_PRICE_ID??'',monthlyPrice:199,serverLimit:50,active:true},
];}
