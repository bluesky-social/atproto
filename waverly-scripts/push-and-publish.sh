#!/bin/bash

# For publishing process and usage of this script see: /README_WAVERLY.md

# Check if the current branch is "waverly"
current_branch=$(git rev-parse --abbrev-ref HEAD)

if [ "$current_branch" != "waverly" ]; then
  echo "Error: The current branch is not 'waverly'. This script is intended for the 'waverly' branch."
  exit 1
fi

# Define the paths to the package.json files
# The order of the files is important, as the packages need to be published in the right order
prefixes=("packages/api/package.json" "packages/pds/package.json" "packages/dev-env/package.json")


# Get the list of modified files in the repository
modified_files=$(git status --porcelain | awk '{print $2}')

# Check if there are any files other than those in package_files
for file in $modified_files; do
  if ! [[ " ${prefixes[@]} " =~ " $file " ]]; then
    echo "Error: Found an unexpected modified file: $file"
    exit 1
  fi
done

# Create an array to store the tags
tags=()
commit_message="Updated package versions:"

# Loop through the package.json files and build the list of tags
for file in "${prefixes[@]}"; do
  if [[ "${modified_files[@]}" =~ "$file" ]]; then
    # Extract the version number
    version=$(jq -r '.version' "$file")

    if [ -n "$version" ]; then
      # Extract the package name from the path using sed
      package_name=$(echo "$file" | sed -E 's@^.*/([^/]+)/[^/]+\.json$@\1@')
      # Build the tag and add it to the list
      tag="@waverlyai/aproto-$package_name@$version"
      tags+=("$tag")
      # Add the version and package name to the commit message
      commit_message+=" $tag"
    else
      echo "Error: Failed to extract version from $file."
      exit 1
    fi
  fi
done

# Check if there are no tags
if [ ${#tags[@]} -eq 0 ]; then
  echo "No version change identified, nothing to do."
  exit 0
fi

# Add and commit all changes with the dynamic commit message
git add .
echo "Running git commit:"
git commit -m "$commit_message"
echo ""

# Create and push Git tags
for tag in "${tags[@]}"; do
  git tag "$tag"
  echo "Created Git tag: $tag"
done
echo ""

# Push the changes and the tags
git push -q origin waverly --tags
echo "Pushed changes and tags to the remote repository."
echo ""

# Publish the changed packages, in the right order
for file in "${prefixes[@]}"; do
  if [[ "${modified_files[@]}" =~ "$file" ]]; then
    package="./${file%/*}"
    echo "Installing package $package"
    pnpm --filter "$package" install --frozen-lockfile --quiet
    echo ""
    echo "Publishing package $package"
    pnpm --filter "$package" publish --publish-branch waverly --access public
  fi
done