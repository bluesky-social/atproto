# Deploying

## First time on cluster

From [https://github.com/kubernetes-sigs/aws-efs-csi-driver/]

Go in [https://us-east-2.console.aws.amazon.com/eks/], navigate to Add-ons and add the Amazon EFS CSI Driver. (I've tried with a yaml and did not worked so I followed the doc main path).

## Setting Up The Python Development Environment

This project uses a virtual environment to manage Python packages.

1- Create a virtual environment in waverly-atp/ with `python3 -m venv .venv`. This will create a virtual environment in the directory `.venv`.
2- Run `source .venv/bin/activate` to activate it in a command line.
3- Run `pip install -r requirements.txt`

## Deploy

```bash
waverly-atp$ python deploy.py prod-test3 --force
```
