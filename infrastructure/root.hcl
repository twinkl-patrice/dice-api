locals {
    account_vars = read_terragrunt_config(find_in_parent_folders("account.hcl"))
    region_vars  = read_terragrunt_config(find_in_parent_folders("region.hcl"))

    account_id   = local.account_vars.locals.account_id
    environment  = local.account_vars.locals.environment
    aws_region   = local.region_vars.locals.aws_region

    bucket_suffix = local.account_vars.locals.bucket_suffix
    infra_prefix  = local.account_vars.locals.infra_prefix

    tags = {
        Name         = local.infra_prefix
        Environment  = local.environment
        Workload     = "dice-api"
        Department   = "Engineering"
    }
}

generate "provider" {
    path      = "provider.tf"
    if_exists = "overwrite_terragrunt"
    contents  = <<EOF
provider "aws" {
    region = "${local.aws_region}"

    default_tags {
        tags = ${jsonencode(local.tags)}
    }
}
EOF
}

remote_state {
    backend = "s3"
    generate = {
        path      = "backend.tf"
        if_exists = "overwrite"
    }
    config = {
        bucket         = "terragrunt-state-for-${local.bucket_suffix}"
        key            = "${path_relative_to_include()}/terraform.tfstate"
        region         = local.aws_region
        encrypt        = true
        dynamodb_table = "terragrunt-lock-${local.infra_prefix}"
    }
}
