locals {
    account_id    = "590183702699"
    environment   = "sandbox"
    account_user  = get_env("AWS_SANDBOX_ACCOUNT_USER")
    bucket_suffix = "dice-api-${local.account_user}"
    infra_prefix  = "dice-api"
}
