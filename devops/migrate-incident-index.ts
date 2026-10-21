// Data-only migration. Infrastructure must already be owned by CloudFormation.
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,QueryCommand,UpdateCommand} from '@aws-sdk/lib-dynamodb';
import {incidentIndexKeys} from '../src/lib/incident-query';
import type {IncidentRecord} from '../src/lib/model';

async function main() {
  const args=process.argv.slice(2),apply=args.includes('--apply');
  const value=(flag:string)=>{const i=args.indexOf(flag);return i<0?undefined:args[i+1]};
  const table=value('--table'),org=value('--org'),region=value('--region');
  if(!table||!org||!region)throw Error('Usage: AWS_PROFILE=<local-profile> node --import tsx devops/migrate-incident-index.ts --table TABLE --org LOCATION --region REGION [--after SORT_KEY] [--apply]');
  const db=DynamoDBDocumentClient.from(new DynamoDBClient({region,endpoint:process.env.SMARTDETECTOR_DYNAMODB_ENDPOINT,maxAttempts:5}));
  let cursor:Record<string,unknown>|undefined=value('--after')?{pk:'ORG#'+org,sk:value('--after')}:undefined;
  let examined=0,indexed=0;
  do {
    const page=await db.send(new QueryCommand({TableName:table,
      KeyConditionExpression:'pk=:pk AND begins_with(sk,:prefix)',
      ExpressionAttributeValues:{':pk':'ORG#'+org,':prefix':'INCIDENT#'},
      ProjectionExpression:'pk,sk,tenantId,serverId,incidentId,startedAt,incidentTime,incidentDevice',
      ConsistentRead:true,ExclusiveStartKey:cursor,Limit:25,
    }));
    for(const item of page.Items??[]) {
      examined++;
      if(item.tenantId!==org||typeof item.serverId!=='string'||typeof item.incidentId!=='string'||typeof item.startedAt!=='string')throw Error('Invalid incident metadata; migration stopped');
      const keys=incidentIndexKeys(item as IncidentRecord);
      if(item.incidentTime===keys.incidentTime&&item.incidentDevice===keys.incidentDevice)continue;
      if(apply)try {
        // Never recreate evidence concurrently removed by retention or purge.
        await db.send(new UpdateCommand({TableName:table,Key:{pk:item.pk,sk:item.sk},
          UpdateExpression:'SET incidentTime=:time,incidentDevice=:device',
          ConditionExpression:'attribute_exists(pk) AND tenantId=:org AND serverId=:server AND startedAt=:at',
          ExpressionAttributeValues:{':time':keys.incidentTime,':device':keys.incidentDevice,':org':org,':server':item.serverId,':at':item.startedAt},
        }));
      }catch(error){if(error instanceof Error&&error.name==='ConditionalCheckFailedException')continue;throw error;}
      indexed++;
    }
    cursor=page.LastEvaluatedKey;
    console.log(JSON.stringify({mode:apply?'apply':'plan',examined,indexed,resumeAfter:cursor?.sk??null}));
  }while(cursor);
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'Migration failed');process.exitCode=1});
