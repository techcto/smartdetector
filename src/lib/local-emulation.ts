// A production-built local container is not an AWS production deployment. This
// exception requires local-only credentials, table and emulator endpoint together.
export function localEmulation(){
 if(process.env.SMARTDETECTOR_LOCAL_REPLAY!=='true'||process.env.AWS_ACCESS_KEY_ID!=='local'||process.env.AWS_SECRET_ACCESS_KEY!=='local'||process.env.SMARTDETECTOR_TABLE!=='smartdetector-local')return false;
 try{return ['smartdetector-dynamodb','localhost','127.0.0.1','[::1]'].includes(new URL(process.env.SMARTDETECTOR_DYNAMODB_ENDPOINT??'').hostname);}catch{return false;}
}
