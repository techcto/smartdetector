import {NextRequest,NextResponse} from 'next/server';
import {operator} from '@/lib/operator';
import {connection} from '@/lib/vision-connection';
export async function GET(req:NextRequest){if(!await operator(req))return NextResponse.json({error:'unauthorized'},{status:401});return NextResponse.json({configured:!!await connection(),managedBy:'deployment',service:'AutoVision'},{headers:{'Cache-Control':'no-store'}});}
export async function POST(req:NextRequest){if(!await operator(req))return NextResponse.json({error:'unauthorized'},{status:401});return NextResponse.json({error:'AutoVision is a system service. Configure SMARTDETECTOR_AUTOVISION_API_KEY in the deployment environment.'},{status:409});}

