import argparse
import os

from waverlyscripts import deploy


AWS_REGION = "us-east-2"
ECR_ENDPOINT = "504923666478.dkr.ecr." + AWS_REGION + ".amazonaws.com"
EKS_CONTEXT = "arn:aws:eks:" + AWS_REGION + ":504923666478:cluster/"

# Define the service
SERVICE = "waverly-atp"

# workspace root
DOCKER_CONTEXT_PATH = os.path.abspath("..") 
SERVICE_PATH = os.path.abspath(".") 

parser = argparse.ArgumentParser()
parser.add_argument("--force", action="store_true")
parser.add_argument("context", help="The EKS Context")
args = parser.parse_args()

os.environ["SUB_DOMAIN"] = "test"
os.environ["PUBLIC_URL"] = "https://pds.test.waverly.social"

def usage() -> None:
    print("USAGE")
    print("deploy.py [--force] [prod-live1|prod-test3]")
    print(
        "  --force                  forces the deploy even if not on the master branch"
    )
    print("  [prod-live1|prod-test3]  The EKS Context")


try:
    deploy.deploy_service2(
        DOCKER_CONTEXT_PATH, SERVICE_PATH, SERVICE, ECR_ENDPOINT, AWS_REGION, EKS_CONTEXT, args.force, args.context
    )
except deploy.DeploymentError as e:
    print(e)
    usage()
    exit(1)



