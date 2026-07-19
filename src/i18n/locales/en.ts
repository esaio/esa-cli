/**
 * 英語リソース（既定言語）。ja.ts はこの型に従うことでキーの欠落を防ぐ。
 * 補間は {{var}}、単一波括弧（{team_name} など）はリテラル。
 */
export const en = {
  cli: {
    description: "Official CLI for esa.io",
  },
  baseUrl: {
    invalid: "Invalid API base URL (check ESA_API_BASE_URL): {{url}}",
    notHttp: "API base URL must be http or https: {{url}}",
    notAllowed:
      "API base URL is not allowed (only api.esa.io or localhost): {{url}}",
  },
  config: {
    desc: "Manage esa-cli settings (~/.config/esa-cli/config.json)",
    setDesc: "Set a config value",
    getDesc: "Get a config value",
    keyArg: "Config key ({{keys}})",
    valueArg: "Value",
    unknownKey: "Unknown config key: {{key}} (supported: {{keys}})",
    emptyValue: "Value for {{key}} is empty.",
    setDone: "Set {{key}} to {{value}}.",
    invalidLanguage: "{{key}} must be one of: {{langs}}",
  },
  auth: {
    desc: "Authenticate esa-cli with esa.io",
    loginDesc: "Log in to esa.io via OAuth (browser)",
    loginSuccess: "Logged in. Saved the token to {{backend}}.",
    loginScope: "Granted scope: {{scope}}",
    logoutDesc: "Log out and remove the stored token",
    revokeFailed:
      "Failed to revoke the token (continuing with deletion): {{error}}",
    logoutDone: "Logged out.",
    tokenDeleted: "Removed the stored token.",
    refreshDesc: "Refresh the OAuth access token using the refresh token",
    notLoggedIn: "You are not logged in with OAuth. Run `esa auth login`.",
    refreshDone: "Refreshed the token ({{backend}}).",
    statusDesc: "Show the current authentication status",
  },
  user: {
    desc: "Show the authenticated user (GET /v1/user)",
  },
  team: {
    desc: "Work with teams",
    listDesc: "List teams you belong to (GET /v1/teams)",
    pageOpt: "Page number",
    perPageOpt: "Items per page",
    roleOpt: "Filter by role (member | owner)",
  },
  post: {
    desc: "Work with posts",
    listDesc: "List posts in a team (GET /v1/teams/{team_name}/posts)",
    listTeamOpt:
      "Target team (defaults to ESA_TEAM / default team / your only team)",
    pageOpt: "Page number",
    perPageOpt: "Items per page",
    queryOpt: "Search query",
    getDesc: "Get a post (GET /v1/teams/{team_name}/posts/{post_number})",
    numberArg: "Post number",
    getTeamOpt: "Target team",
    idLabel: "post number",
    searchDesc: "Search posts in a team (GET /v1/teams/{team_name}/posts)",
    searchQueryArg: "Search query",
    createDesc: "Create a post (POST /v1/teams/{team_name}/posts)",
    createNameArg: "Post name (title); a '/' in the name sets the category",
    updateDesc:
      "Update a post (PATCH /v1/teams/{team_name}/posts/{post_number})",
    appendDesc: "Append Markdown to the end of a post's body",
    prependDesc: "Prepend Markdown to the start of a post's body",
    archiveDesc: "Archive a post by moving it under the Archived/ category",
    deleteDesc:
      "Delete a post (DELETE /v1/teams/{team_name}/posts/{post_number})",
    nameOpt: "Post name (title)",
    categoryOpt: "Category path (e.g. dev/docs)",
    tagsOpt: "Comma-separated tags (e.g. a,b,c)",
    bodyOpt: "Body in Markdown",
    bodyFileOpt: "Read the body from a file (use - for stdin)",
    wipOpt: "Mark as Work In Progress",
    shipOpt: "Ship it (mark as not WIP)",
    messageOpt: "Change message",
    yesOpt: "Skip the confirmation prompt",
    bodyConflict: "Cannot use --body and --body-file together.",
    bodyRequired: "Body is required (--body or --body-file).",
    wipConflict: "Cannot use --wip and --ship together.",
    emptyName: "Post name is empty.",
    alreadyArchived: "Post #{{number}} is already archived ({{category}}).",
    deleteConfirm: 'Delete post #{{number}} "{{name}}"? [y/N]:',
    deleteConfirmRequired:
      "Deletion requires confirmation. Pass --yes in a non-interactive environment.",
    deleteCanceled: "Canceled.",
    deleteDone: "Deleted post #{{number}}.",
  },
  parse: {
    notPositiveInt: "{{name}} must be a positive integer (>= 1): {{value}}",
  },
  oauth: {
    fetchingMetadata: "Fetching authorization server metadata...",
    openingBrowser: "Opening the authorization page in your browser...",
    openUrlManually: "If it does not open, visit this URL:\n{{url}}\n",
    waiting: "Waiting for authorization in the browser...",
    tokenFetchFailed: "Failed to obtain the token: {{error}}",
    tokenRefreshFailed: "Failed to refresh the token: {{error}}",
    noRefreshToken: "No refresh_token. Please log in again.",
  },
  discovery: {
    notUrl:
      "Authorization server metadata field {{field}} is not a URL: {{value}}",
    notHttps: "{{field}} must be HTTPS: {{value}}",
    missingField: "Authorization server metadata is missing {{field}}",
    fetchFailed:
      "Failed to fetch authorization server metadata ({{url}}): {{error}}",
    pkceUnsupported:
      "Authorization server does not support PKCE (S256): {{methods}}",
  },
  apiClient: {
    noAuth:
      "No credentials. Log in with `esa auth login`, or set ESA_ACCESS_TOKEN.",
    connectionFailed: "Failed to connect to the esa API: {{error}}",
  },
  apiResponse: {
    authFailed:
      "Authentication failed (401). Log in again with `esa auth login`, or check ESA_ACCESS_TOKEN.",
    requestFailed: "esa API request failed ({{status}}): {{detail}}",
  },
  resolveTeam: {
    noTeams: "You do not belong to any team.",
    multipleTeams:
      "You belong to multiple teams. Specify one with --team, or set a default with `esa config set default-team <name>`.\nTeams: {{teams}}",
  },
  tokenStore: {
    encryptedFileLabel: "encrypted file (~/.config/esa-cli)",
    saveFailed: "Failed to save the token ({{backend}}): {{error}}",
    parseWarning:
      "Warning: failed to parse token data ({{backend}}): {{error}}. Log in again with `esa auth login`.",
  },
  credentialManager: {
    tooLarge:
      "Data size ({{size}} bytes) exceeds the Windows Credential Manager limit ({{max}} bytes)",
  },
  secretService: {
    locked:
      'The keyring is locked. Unlock the login keyring in "Passwords and Keys" (seahorse), or disable automatic login and sign in again, then run `esa auth login`.',
  },
  callback: {
    notFound: "Not Found",
    successTitle: "Authentication complete",
    successBody: "You can close this tab and return to your terminal.",
    canceledBrowser: "Authorization was canceled: {{error}}",
    canceledError: "Authorization error: {{error}} {{description}}",
    stateMismatchBrowser: "state does not match",
    stateMismatchError: "state does not match (possible CSRF)",
    noCodeBrowser: "No authorization code",
    noCodeError: "No authorization code was returned",
    timeout: "Authentication timed out (5 minutes)",
  },
};

export type Resources = typeof en;
