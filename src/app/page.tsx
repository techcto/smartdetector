import PublicHome from './public-home';
export default function Page(){return <PublicHome local={process.env.SMARTDETECTOR_DEPLOYMENT_MODE!=='saas'}/>}
