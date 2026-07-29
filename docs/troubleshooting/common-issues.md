# Common Issues

<details>

<summary>Policies not appearing in Group Policy Management Console</summary>

- Verify that the ADMX/ADML files are in the correct location (see [Windows deployment docs](../deployment/chrome-edge-deployment-instructions/windows/README.md))
- Ensure that the files are not blocked (right-click > Properties > Unblock)
- Refresh Group Policy Editor

For complete deployment instructions, see [Domain Deployment guide](../deployment/chrome-edge-deployment-instructions/windows/domain-deployment.md).

</details>

<details>

<summary>Policies not applying to extension</summary>

- Check that the registry values are present (see [Manual Deployment guide](../deployment/chrome-edge-deployment-instructions/windows/manual-deployment.md))
- Restart the browser after policy changes
- Verify that the extension has the necessary permissions

For troubleshooting policy deployment, consult the [Windows deployment documentation](../deployment/chrome-edge-deployment-instructions/windows/README.md).

</details>

<details>

<summary>Custom branding not working</summary>

- Verify URLs are accessible via HTTPS
- Check that the image format is supported (PNG, JPG, or SVG)
- Ensure that color codes use a valid hexadecimal format

</details>
