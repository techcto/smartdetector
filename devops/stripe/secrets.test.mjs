import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

for (const file of ['smartdetector.yaml', 'smartdetector-existing.yaml']) {
  const template = JSON.parse(readFileSync(new URL('../cloudformation/' + file, import.meta.url)));
  test(file + ': core secrets retain original values and never appear in task environment', () => {
    const entries = [
      ['RootPasswordSecret', 'RootPassword', 'SMARTDETECTOR_ROOT_PASSWORD'],
      ['SessionSigningSecret', 'SessionSecret', 'SMARTDETECTOR_SESSION_SECRET'],
      ['ProviderEncryptionSecret', 'ProviderSecret', 'SMARTDETECTOR_PROVIDER_SECRET'],
    ];
    for (const [logical, parameter, name] of entries) {
      const secret = template.Resources[logical];
      assert.equal(secret.Type, 'AWS::SecretsManager::Secret');
      assert.equal(secret.DeletionPolicy, 'Retain');
      assert.equal(secret.UpdateReplacePolicy, 'Retain');
      assert.equal(secret.Properties.GenerateSecretString, undefined);
      assert.equal(template.Parameters[parameter].NoEcho, true);
      assert.deepEqual(template.Outputs[logical + 'Arn'].Value, {Ref: logical});
      if (parameter === 'ProviderSecret') {
        assert.deepEqual(secret.Properties.SecretString, {
          'Fn::If': ['HasProviderSecret', {Ref: 'ProviderSecret'}, {Ref: 'SessionSecret'}],
        });
      } else assert.deepEqual(secret.Properties.SecretString, {Ref: parameter});
      for (const resource of Object.values(template.Resources)) {
        if (resource.Type !== 'AWS::ECS::TaskDefinition') continue;
        for (const container of resource.Properties.ContainerDefinitions) {
          assert.ok(!container.Environment.some(value => value.Name === name));
          assert.deepEqual(container.Secrets.find(value => value.Name === name), {
            Name: name, ValueFrom: {Ref: logical},
          });
          assert.ok(container.Environment.some(value => value.Name === 'SMARTDETECTOR_CORE_SECRETS_REVISION'));
        }
      }
    }
    const read = template.Resources.ExecutionRole.Properties.Policies.find(value => value.PolicyName === 'core-secrets-read');
    assert.deepEqual(read.PolicyDocument.Statement[0].Resource, entries.map(([logical]) => ({Ref: logical})));
    assert.equal(read.PolicyDocument.Statement[0].Action, 'secretsmanager:GetSecretValue');
    assert.ok(!JSON.stringify(template.Resources.TaskRole).includes('core-secrets-read'));
  });
  test(file + ': credential-source rules reject mixed or partial inputs', () => {
    function evaluate(value, parameters) {
      if (typeof value !== 'object') return value;
      if (value.Ref) return parameters[value.Ref];
      const [operation, args] = Object.entries(value)[0];
      const values = args.map(arg => evaluate(arg, parameters));
      if (operation === 'Fn::Equals') return values[0] === values[1];
      if (operation === 'Fn::Not') return !values[0];
      if (operation === 'Fn::And') return values.every(Boolean);
      if (operation === 'Fn::Or') return values.some(Boolean);
      throw new Error(operation);
    }
    for (const [arn, key, webhook, expected] of [
      ['', '', '', true], ['secret-arn', '', '', true],
      ['', 'sk_live_value', 'whsec_value', true],
      ['', 'sk_test_value', 'whsec_value', true],
      ['', 'sk_live_value', '', false], ['', '', 'whsec_value', false],
      ['secret-arn', 'sk_live_value', 'whsec_value', false],
    ]) {
      const parameters = {StripeCredentialsSecretArn: arn, StripeSecretKey: key, StripeWebhookSecret: webhook};
      assert.equal(evaluate(template.Rules.StripeCredentialSource.Assertions[0].Assert, parameters), expected);
      assert.equal(evaluate(template.Conditions.UseStripeCredentials, parameters), Boolean(arn || key));
      assert.equal(evaluate(template.Conditions.CreateStripeSecret, parameters), Boolean(!arn && key));
    }
  });
  test(file + ': credentials are injected by ECS, never plaintext task values', () => {
    let count = 0;
    for (const resource of Object.values(template.Resources)) {
      if (resource.Type !== 'AWS::ECS::TaskDefinition') continue;
      for (const container of resource.Properties.ContainerDefinitions) {
        for (const name of ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']) {
          assert.ok(!container.Environment.some(value => value.Name === name));
          const injected = container.Secrets.find(value => value['Fn::If']?.[1]?.Name === name);
          assert.equal(injected['Fn::If'][0], 'UseStripeCredentials');
          assert.ok(injected['Fn::If'][1].ValueFrom['Fn::Join']);
        }
        assert.ok(container.Environment.some(value => value.Name === 'SMARTDETECTOR_STRIPE_CREDENTIALS_REVISION'));
        count++;
      }
    }
    assert.equal(count, 3);
  });
  test(file + ': retained secret, restricted IAM and no secret-valued output', () => {
    const secret = template.Resources.StripeCredentials;
    assert.equal(secret.DeletionPolicy, 'Retain');
    assert.equal(secret.UpdateReplacePolicy, 'Retain');
    assert.equal(secret.Condition, 'CreateStripeSecret');
    assert.equal(template.Outputs.StripeCredentialsSecretArn.Condition, 'UseStripeCredentials');
    const policies = JSON.stringify(template.Resources.ExecutionRole.Properties.Policies);
    assert.ok(policies.includes('stripe-credentials-read'));
    assert.ok(policies.includes('kms:EncryptionContext:SecretARN'));
    assert.ok(!JSON.stringify(template.Resources.TaskRole).includes('StripeCredentials'));
    assert.ok(template.Rules.StripeCredentialSource);
    for (const name of ['StripeSecretKey', 'StripeWebhookSecret']) {
      assert.equal(template.Parameters[name].NoEcho, true);
      assert.ok(new RegExp(template.Parameters[name].AllowedPattern).test(''));
      assert.ok(!new RegExp(template.Parameters[name].AllowedPattern).test('invalid"json'));
    }
  });
}
