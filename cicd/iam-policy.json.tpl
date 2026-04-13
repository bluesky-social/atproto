{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRAuth",
      "Effect": "Allow",
      "Action": ["ecr:GetAuthorizationToken"],
      "Resource": "*"
    },
    {
      "Sid": "ECRPush",
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "arn:aws:ecr:${REGION}:${AWS_ACCOUNT_ID}:repository/${PROJECT}/*"
    },
    {
      "Sid": "RunPdsControlPlaneTask",
      "Effect": "Allow",
      "Action": ["ecs:RunTask"],
      "Resource": "arn:aws:ecs:${REGION}:${AWS_ACCOUNT_ID}:task-definition/${PROJECT}-${ENVIRONMENT}-pds-control-plane:*"
    },
    {
      "Sid": "PassPdsControlPlaneRoles",
      "Effect": "Allow",
      "Action": ["iam:PassRole"],
      "Resource": [
        "arn:aws:iam::${AWS_ACCOUNT_ID}:role/${PROJECT}-${ENVIRONMENT}-pds-control-plane-task",
        "arn:aws:iam::${AWS_ACCOUNT_ID}:role/${PROJECT}-${ENVIRONMENT}-pds-control-plane-task-execution"
      ],
      "Condition": {
        "StringEquals": {
          "iam:PassedToService": "ecs-tasks.amazonaws.com"
        }
      }
    }
  ]
}
