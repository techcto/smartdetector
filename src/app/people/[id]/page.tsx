import PersonDetail from './person-detail';
export default async function Page({params}:{params:Promise<{id:string}>}){return <PersonDetail id={(await params).id}/>;}
