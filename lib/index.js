/**
 * dsh-shortcuts, node half.
 *
 * The feature lives entirely in the browser half (../client.js): one
 * contribution into the `conversation.input.left` composer slot plus a
 * locale dictionary namespace. The host loader still imports one entry per
 * roster row, so this half is a deliberate no-op plugin — no services, no
 * config, nothing to inject (same shape as the shipped skin plugins).
 */

/** Cordis plugin name. */
export const name = "dsh-shortcuts";

/** No host-side dependencies. */
export const inject = [];

/** No-op apply: the entry only needs to activate cleanly on the host. */
export function apply() {}
