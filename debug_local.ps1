param (
    [Parameter(Mandatory=$true)]
    [string]$BranchName
)

git reset --hard origin/testing
git pull
git pull origin $BranchName --no-edit