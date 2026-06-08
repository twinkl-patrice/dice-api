include "root" {
    path = find_in_parent_folders("root.hcl")
}

locals {
    account_vars = read_terragrunt_config(find_in_parent_folders("account.hcl"))
    region_vars  = read_terragrunt_config(find_in_parent_folders("region.hcl"))
}

terraform {
    source = "../../../modules/dice-api"
}

inputs = merge(
    local.region_vars.locals,
    local.account_vars.locals,
    {
        service_name             = "dice-api"
        dist_path                = "${get_repo_root()}/dist"
        enable_stream_processor  = false
        enable_direct_publish    = true
    }
)
