# Cost-optimized wasty_admin deploy: ECR + ECS Fargate (NO ALB)
# Prereq: docker image wasty-admin:prod already built; aws login done.
$ErrorActionPreference = "Stop"
$Region = "ap-south-1"
$Account = "362525015989"
$Repo = "wasty-admin"
$Cluster = "wasty-admin"
$Service = "wasty-admin"
$ImageUri = "$Account.dkr.ecr.$Region.amazonaws.com/${Repo}:prod"
$Root = Split-Path -Parent $PSScriptRoot
$AdminJsonPath = "C:\Users\KAIF\Downloads\wastyb-7a08b-firebase-adminsdk-fbsvc-317de82cdb.json"

Write-Host "==> SSM secret"
$json = Get-Content $AdminJsonPath -Raw
aws ssm put-parameter --name /wasty/admin/FIREBASE_ADMIN_SDK_JSON --type SecureString --value $json --overwrite --region $Region | Out-Null

Write-Host "==> ECR login + push"
aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin "$Account.dkr.ecr.$Region.amazonaws.com"
docker tag wasty-admin:prod $ImageUri
docker push $ImageUri

$VpcId = aws ec2 describe-vpcs --region $Region --filters Name=isDefault,Values=true --query "Vpcs[0].VpcId" --output text
$SubnetId = aws ec2 describe-subnets --region $Region --filters Name=vpc-id,Values=$VpcId --query "Subnets[0].SubnetId" --output text

$SgId = aws ec2 describe-security-groups --region $Region --filters Name=group-name,Values=wasty-admin-sg Name=vpc-id,Values=$VpcId --query "SecurityGroups[0].GroupId" --output text 2>$null
if (-not $SgId -or $SgId -eq "None") {
  $SgId = aws ec2 create-security-group --region $Region --group-name wasty-admin-sg --description "Wasty admin" --vpc-id $VpcId --query GroupId --output text
  aws ec2 authorize-security-group-ingress --region $Region --group-id $SgId --protocol tcp --port 3000 --cidr 0.0.0.0/0 | Out-Null
}

# IAM execution role
try { aws iam get-role --role-name ecsTaskExecutionRole | Out-Null } catch {
  $trust = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
  $trustPath = Join-Path $Root ".ecs-trust.json"
  Set-Content -Path $trustPath -Value $trust -NoNewline
  aws iam create-role --role-name ecsTaskExecutionRole --assume-role-policy-document "file://$($trustPath.Replace('\','/'))" | Out-Null
  aws iam attach-role-policy --role-name ecsTaskExecutionRole --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy | Out-Null
}
$ssmPolicy = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["ssm:GetParameters","ssm:GetParameter","kms:Decrypt"],"Resource":"*"}]}'
$ssmPath = Join-Path $Root ".ecs-ssm-policy.json"
Set-Content -Path $ssmPath -Value $ssmPolicy -NoNewline
aws iam put-role-policy --role-name ecsTaskExecutionRole --policy-name wastyAdminExecSsm --policy-document "file://$($ssmPath.Replace('\','/'))" | Out-Null

try { aws iam get-role --role-name wastyAdminTaskRole | Out-Null } catch {
  $trustPath = Join-Path $Root ".ecs-trust.json"
  if (-not (Test-Path $trustPath)) {
    Set-Content -Path $trustPath -Value '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}' -NoNewline
  }
  aws iam create-role --role-name wastyAdminTaskRole --assume-role-policy-document "file://$($trustPath.Replace('\','/'))" | Out-Null
  aws iam put-role-policy --role-name wastyAdminTaskRole --policy-name wastyAdminSsm --policy-document "file://$($ssmPath.Replace('\','/'))" | Out-Null
}

$ExecRoleArn = aws iam get-role --role-name ecsTaskExecutionRole --query Role.Arn --output text
$TaskRoleArn = aws iam get-role --role-name wastyAdminTaskRole --query Role.Arn --output text

$taskDef = @{
  family = "wasty-admin"
  networkMode = "awsvpc"
  requiresCompatibilities = @("FARGATE")
  cpu = "256"
  memory = "512"
  executionRoleArn = $ExecRoleArn
  taskRoleArn = $TaskRoleArn
  containerDefinitions = @(
    @{
      name = "wasty-admin"
      image = $ImageUri
      essential = $true
      portMappings = @(@{ containerPort = 3000; protocol = "tcp" })
      environment = @(
        @{ name = "NODE_ENV"; value = "production" }
        @{ name = "WASTY_DATA_PROVIDER"; value = "aws" }
        @{ name = "WASTY_API_BASE_URL"; value = "https://ugsyl4a20d.execute-api.ap-south-1.amazonaws.com" }
        @{ name = "NEXT_PUBLIC_FIREBASE_API_KEY"; value = "AIzaSyBSvJAFW0hm8Ejx46oHaaSSA2acnXdZVek" }
        @{ name = "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"; value = "wastyb-7a08b.firebaseapp.com" }
        @{ name = "NEXT_PUBLIC_FIREBASE_PROJECT_ID"; value = "wastyb-7a08b" }
        @{ name = "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"; value = "wastyb-7a08b.firebasestorage.app" }
        @{ name = "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"; value = "952854274064" }
        @{ name = "NEXT_PUBLIC_FIREBASE_APP_ID"; value = "1:952854274064:web:00a43ee126ac887225ea95" }
      )
      secrets = @(
        @{
          name = "FIREBASE_ADMIN_SDK_JSON"
          valueFrom = "arn:aws:ssm:${Region}:${Account}:parameter/wasty/admin/FIREBASE_ADMIN_SDK_JSON"
        }
      )
      logConfiguration = @{
        logDriver = "awslogs"
        options = @{
          "awslogs-group" = "/ecs/wasty-admin"
          "awslogs-region" = $Region
          "awslogs-stream-prefix" = "ecs"
          "awslogs-create-group" = "true"
        }
      }
      healthCheck = @{
        command = @("CMD-SHELL", "wget -qO- http://127.0.0.1:3000/api/health || exit 1")
        interval = 30
        timeout = 5
        retries = 3
        startPeriod = 60
      }
    }
  )
}

$taskDefPath = Join-Path $Root ".ecs-task-def.json"
($taskDef | ConvertTo-Json -Depth 12) | Set-Content -Path $taskDefPath -Encoding utf8
$TaskDefArn = aws ecs register-task-definition --region $Region --cli-input-json "file://$($taskDefPath.Replace('\','/'))" --query taskDefinition.taskDefinitionArn --output text
Write-Host "Task def: $TaskDefArn"

$clusterStatus = aws ecs describe-clusters --region $Region --clusters $Cluster --query "clusters[0].status" --output text 2>$null
if (-not $clusterStatus -or $clusterStatus -eq "None" -or $clusterStatus -eq "INACTIVE") {
  aws ecs create-cluster --region $Region --cluster-name $Cluster | Out-Null
}

$svcStatus = aws ecs describe-services --region $Region --cluster $Cluster --services $Service --query "services[0].status" --output text 2>$null
if ($svcStatus -and $svcStatus -ne "None" -and $svcStatus -ne "INACTIVE") {
  aws ecs update-service --region $Region --cluster $Cluster --service $Service --task-definition $TaskDefArn --force-new-deployment | Out-Null
} else {
  aws ecs create-service --region $Region --cluster $Cluster --service-name $Service --task-definition $TaskDefArn --desired-count 1 --launch-type FARGATE --network-configuration "awsvpcConfiguration={subnets=[$SubnetId],securityGroups=[$SgId],assignPublicIp=ENABLED}" | Out-Null
}

Write-Host "Waiting for public IP..."
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Seconds 10
  $taskArn = aws ecs list-tasks --region $Region --cluster $Cluster --service-name $Service --desired-status RUNNING --query "taskArns[0]" --output text
  if (-not $taskArn -or $taskArn -eq "None") { Write-Host "  attempt $($i+1) no task"; continue }
  $eni = aws ecs describe-tasks --region $Region --cluster $Cluster --tasks $taskArn --query "tasks[0].attachments[0].details[?name=='networkInterfaceId'].value | [0]" --output text
  if (-not $eni -or $eni -eq "None") { continue }
  $ip = aws ec2 describe-network-interfaces --region $Region --network-interface-ids $eni --query "NetworkInterfaces[0].Association.PublicIp" --output text
  if ($ip -and $ip -ne "None") {
    Write-Host ""
    Write-Host "ADMIN_URL=http://${ip}:3000"
    Write-Host "LOGIN_URL=http://${ip}:3000/auth/v2/login"
    Write-Host "HEALTH_URL=http://${ip}:3000/api/health"
    exit 0
  }
}
Write-Error "Timed out waiting for public IP"
exit 1
