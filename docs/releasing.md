# Releasing Klever Signal

This project uses Semantic Versioning. Until 1.0.0, minor releases may still change the experimental rule and report contracts; document such changes clearly.

## Release checklist

1. Confirm the working tree contains only intentional release changes.
2. Update `CHANGELOG.md` with the release date, additions, changes, fixes, security notes, and known limitations.
3. Confirm the version in `package.json` and the changelog heading match.
4. Run:

   ```bash
   npm test
   npm run smoke
   npm pack --dry-run
   ```

5. Run an audit against a disposable synthetic fixture and inspect Markdown, HTML, JSON, and one `resume` report.
6. Review the package contents for credentials, session artifacts, local paths, and unintended files.
7. Commit the release as one focused change and create an annotated Git tag such as `v0.1.0`.
8. Publish the GitHub release from that tag.
9. Publish to npm only after package metadata, provenance, and access policy are confirmed.
10. Add the comparison link for the new version to `CHANGELOG.md`.

## Before npm publication

Verify the package with:

```bash
npm pack --dry-run
npm publish --access public --dry-run
```

The package is currently not published. Until then, users should use the GitHub `npx` form documented in the README or clone the repository.

## Release boundaries

Publishing is separate from implementation verification. A passing test suite proves the local package contract; it does not prove that npm metadata, GitHub permissions, provenance, or the published artifact are correct. Record those checks independently in the release notes.
