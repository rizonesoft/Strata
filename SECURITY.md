# Security

## What counts as a vulnerability in Strata?

Strata reads disk images that an attacker may have prepared. These are vulnerabilities:

- A crafted image, file system structure or artifact that makes Strata crash, hang, exhaust memory or run code.
- Any way to make Strata write to an evidence image.
- A way to make Strata report a hash as verified when it is not, or to alter the audit log without breaking its chain.
- A report or export that runs script or loads a remote resource when opened.

A wrong parse of a valid structure is a bug, not a vulnerability: open a normal issue for it.

## How do I report one?

Report it privately through GitHub: open the **Security** tab of this repository and choose **Report a vulnerability**. Do not open a public issue.

Include the version or commit, what you did, what happened, and a minimal sample that shows it. Never send data from a real case: build a small synthetic image that reproduces the problem.

## What happens next?

You will get an acknowledgement within seven days. A fix is developed in private, released, and then described in a security advisory that credits you unless you ask otherwise.

## Which versions are supported?

Strata is pre-alpha and has no release yet. Once releases exist, the latest one is supported.
