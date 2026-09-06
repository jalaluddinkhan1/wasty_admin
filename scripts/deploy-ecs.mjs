#!/usr/bin/env node
/**
 * Cost-optimized admin deploy: ECR + ECS Fargate (no ALB).
 * Public IP on the task + optional CloudFront later.
 *
 * Prereq: docker image wasty-admin:prod built; aws login done.
 * Reads FIREBASE_ADMIN_SDK_PATH from .env.local and stores JSON in SSM.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const REGION = process.env.AWS_REGION || "ap-south-1";
const ACCOUNT = process.env.AWS_ACCOUNT_ID || "362525015989";
const REPO = "wasty-admin";
const CLUSTER = "wasty-admin";
const SERVICE = "wasty-admin";
const IMAGE_URI = `${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/${REPO}:prod`;

function sh(cmd, opts = {}) {
  console.log(`$ ${cmd}`);
  return execSync(cmd, { stdio: "inherit", ...opts });
}

function shOut(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function loadEnvLocal() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnvLocal();

const adminPath = process.env.FIREBASE_ADMIN_SDK_PATH;
if (!adminPath || !fs.existsSync(adminPath)) {
  throw new Error("FIREBASE_ADMIN_SDK_PATH missing — needed for session cookies");
}
const adminJson = fs.readFileSync(adminPath, "utf8");

console.log("→ Put Firebase Admin JSON in SSM");
sh(
  `aws ssm put-parameter --name /wasty/admin/FIREBASE_ADMIN_SDK_JSON --type SecureString --value ${JSON.stringify(adminJson)} --overwrite --region ${REGION}`,
);

console.log("→ ECR login + push");
sh(`aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com`);
sh(`docker tag wasty-admin:prod ${IMAGE_URI}`);
sh(`docker push ${IMAGE_URI}`);

const vpcId = shOut(
  `aws ec2 describe-vpcs --region ${REGION} --filters Name=isDefault,Values=true --query Vpcs[0].VpcId --output text`,
);
const subnet = shOut(
  `aws ec2 describe-subnets --region ${REGION} --filters Name=vpc-id,Values=${vpcId} --query "Subnets[0].SubnetId" --output text`,
);

let sgId;
try {
  sgId = shOut(
    `aws ec2 describe-security-groups --region ${REGION} --filters Name=group-name,Values=wasty-admin-sg Name=vpc-id,Values=${vpcId} --query "SecurityGroups[0].GroupId" --output text`,
  );
  if (!sgId || sgId === "None") throw new Error("missing");
} catch {
  sgId = shOut(
    `aws ec2 create-security-group --region ${REGION} --group-name wasty-admin-sg --description "Wasty admin Next.js" --vpc-id ${vpcId} --query GroupId --output text`,
  );
  sh(
    `aws ec2 authorize-security-group-ingress --region ${REGION} --group-id ${sgId} --protocol tcp --port 3000 --cidr 0.0.0.0/0`,
  );
}

console.log("→ IAM roles (ecsTaskExecutionRole / wastyAdminTaskRole)");
try {
  shOut(`aws iam get-role --role-name ecsTaskExecutionRole --query Role.Arn --output text`);
} catch {
  const trust = JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { Service: "ecs-tasks.amazonaws.com" },
        Action: "sts:AssumeRole",
      },
    ],
  });
  fs.writeFileSync(path.join(root, ".ecs-trust.json"), trust);
  sh(
    `aws iam create-role --role-name ecsTaskExecutionRole --assume-role-policy-document file://${path.join(root, ".ecs-trust.json").replace(/\\/g, "/")}`,
  );
  sh(
    `aws iam attach-role-policy --role-name ecsTaskExecutionRole --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy`,
  );
}

let taskRoleArn;
try {
  taskRoleArn = shOut(`aws iam get-role --role-name wastyAdminTaskRole --query Role.Arn --output text`);
} catch {
  const trust = JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { Service: "ecs-tasks.amazonaws.com" },
        Action: "sts:AssumeRole",
      },
    ],
  });
  fs.writeFileSync(path.join(root, ".ecs-trust.json"), trust);
  taskRoleArn = shOut(
    `aws iam create-role --role-name wastyAdminTaskRole --assume-role-policy-document file://${path.join(root, ".ecs-trust.json").replace(/\\/g, "/")} --query Role.Arn --output text`,
  );
  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: ["ssm:GetParameters", "ssm:GetParameter"],
        Resource: `arn:aws:ssm:${REGION}:${ACCOUNT}:parameter/wasty/admin/*`,
      },
    ],
  };
  fs.writeFileSync(path.join(root, ".ecs-ssm-policy.json"), JSON.stringify(policy));
  sh(
    `aws iam put-role-policy --role-name wastyAdminTaskRole --policy-name wastyAdminSsm --policy-document file://${path.join(root, ".ecs-ssm-policy.json").replace(/\\/g, "/")}`,
  );
}

const execRoleArn = shOut(`aws iam get-role --role-name ecsTaskExecutionRole --query Role.Arn --output text`);

// Allow execution role to read SSM for secrets injection
sh(
  `aws iam put-role-policy --role-name ecsTaskExecutionRole --policy-name wastyAdminExecSsm --policy-document ${JSON.stringify(
    JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: ["ssm:GetParameters", "ssm:GetParameter", "kms:Decrypt"],
          Resource: "*",
        },
      ],
    }),
  )}`,
);

const taskDef = {
  family: "wasty-admin",
  networkMode: "awsvpc",
  requiresCompatibilities: ["FARGATE"],
  cpu: "256",
  memory: "512",
  executionRoleArn: execRoleArn,
  taskRoleArn,
  containerDefinitions: [
    {
      name: "wasty-admin",
      image: IMAGE_URI,
      essential: true,
      portMappings: [{ containerPort: 3000, protocol: "tcp" }],
      environment: [
        { name: "NODE_ENV", value: "production" },
        { name: "WASTY_DATA_PROVIDER", value: "aws" },
        {
          name: "WASTY_API_BASE_URL",
          value: "https://ugsyl4a20d.execute-api.ap-south-1.amazonaws.com",
        },
        { name: "NEXT_PUBLIC_FIREBASE_API_KEY", value: "AIzaSyBSvJAFW0hm8Ejx46oHaaSSA2acnXdZVek" },
        { name: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", value: "wastyb-7a08b.firebaseapp.com" },
        { name: "NEXT_PUBLIC_FIREBASE_PROJECT_ID", value: "wastyb-7a08b" },
        {
          name: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
          value: "wastyb-7a08b.firebasestorage.app",
        },
        { name: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", value: "952854274064" },
        {
          name: "NEXT_PUBLIC_FIREBASE_APP_ID",
          value: "1:952854274064:web:00a43ee126ac887225ea95",
        },
      ],
      secrets: [
        {
          name: "FIREBASE_ADMIN_SDK_JSON",
          valueFrom: `arn:aws:ssm:${REGION}:${ACCOUNT}:parameter/wasty/admin/FIREBASE_ADMIN_SDK_JSON`,
        },
      ],
      logConfiguration: {
        logDriver: "awslogs",
        options: {
          "awslogs-group": "/ecs/wasty-admin",
          "awslogs-region": REGION,
          "awslogs-stream-prefix": "ecs",
          "awslogs-create-group": "true",
        },
      },
      healthCheck: {
        command: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/api/health || exit 1"],
        interval: 30,
        timeout: 5,
        retries: 3,
        startPeriod: 60,
      },
    },
  ],
};

const taskDefPath = path.join(root, ".ecs-task-def.json");
fs.writeFileSync(taskDefPath, JSON.stringify(taskDef, null, 2));
const taskDefArn = shOut(
  `aws ecs register-task-definition --region ${REGION} --cli-input-json file://${taskDefPath.replace(/\\/g, "/")} --query taskDefinition.taskDefinitionArn --output text`,
);
console.log("Task def:", taskDefArn);

try {
  shOut(`aws ecs describe-clusters --region ${REGION} --clusters ${CLUSTER} --query clusters[0].status --output text`);
} catch {
  sh(`aws ecs create-cluster --region ${REGION} --cluster-name ${CLUSTER}`);
}

const exists = (() => {
  try {
    const st = shOut(
      `aws ecs describe-services --region ${REGION} --cluster ${CLUSTER} --services ${SERVICE} --query services[0].status --output text`,
    );
    return st && st !== "None" && st !== "INACTIVE";
  } catch {
    return false;
  }
})();

if (exists) {
  sh(
    `aws ecs update-service --region ${REGION} --cluster ${CLUSTER} --service ${SERVICE} --task-definition ${taskDefArn} --force-new-deployment`,
  );
} else {
  sh(
    `aws ecs create-service --region ${REGION} --cluster ${CLUSTER} --service-name ${SERVICE} --task-definition ${taskDefArn} --desired-count 1 --launch-type FARGATE --network-configuration "awsvpcConfiguration={subnets=[${subnet}],securityGroups=[${sgId}],assignPublicIp=ENABLED}"`,
  );
}

console.log("Waiting for running task…");
for (let i = 0; i < 36; i++) {
  await new Promise((r) => setTimeout(r, 10000));
  const tasks = shOut(
    `aws ecs list-tasks --region ${REGION} --cluster ${CLUSTER} --service-name ${SERVICE} --desired-status RUNNING --query taskArns[0] --output text`,
  );
  if (!tasks || tasks === "None") {
    console.log(`  … attempt ${i + 1}`);
    continue;
  }
  const eni = shOut(
    `aws ecs describe-tasks --region ${REGION} --cluster ${CLUSTER} --tasks ${tasks} --query "tasks[0].attachments[0].details[?name=='networkInterfaceId'].value | [0]" --output text`,
  );
  if (!eni || eni === "None") continue;
  const ip = shOut(
    `aws ec2 describe-network-interfaces --region ${REGION} --network-interface-ids ${eni} --query "NetworkInterfaces[0].Association.PublicIp" --output text`,
  );
  if (ip && ip !== "None") {
    console.log("\n✅ Admin live (no ALB — cost optimized)");
    console.log(`   URL:  http://${ip}:3000`);
    console.log(`   Login: /auth/v2/login`);
    console.log(`   Health: http://${ip}:3000/api/health`);
    process.exit(0);
  }
}

console.error("Timed out waiting for public IP — check ECS console");
process.exit(1);
