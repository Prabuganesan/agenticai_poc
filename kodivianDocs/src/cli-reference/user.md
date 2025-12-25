# User

## List User Emails

This command allows you to list all user emails registered in the system.

### Local Usage

```bash
pnpm user
```

Or if using npm

```bash
npx Kodivian user
```

### Docker Usage

If you're running Kodivian in a Docker container, use the following command:

```bash
docker exec -it Kodivian_CONTAINER_NAME pnpm user
```

Replace `Kodivian_CONTAINER_NAME` with your actual Kodivian container name.

## Reset User Password

This command allows you to reset a user's password.

### Local Usage

```bash
pnpm user --email "admin@admin.com" --password "myPassword1!"
```

Or if using npm

```
npx Kodivian user --email "admin@admin.com" --password "myPassword1!"
```

### Docker Usage

If you're running Kodivian in a Docker container, use the following command:

```bash
docker exec -it Kodivian_CONTAINER_NAME pnpm user --email "admin@admin.com" --password "myPassword1!"
```

Replace `Kodivian_CONTAINER_NAME` with your actual Kodivian container name.

### Parameters

* `--email`: The email address of the user whose password you want to reset
* `--password`: The new password to set for the user
