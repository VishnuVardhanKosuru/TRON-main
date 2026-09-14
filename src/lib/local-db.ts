/**
 * TRON — local data handles.
 *
 * This module replaces the old Firebase entry point. `db` is the handle passed
 * into collection()/doc(); `auth` exposes the current owner for the couple of
 * places that read it directly.
 */

import { localDb } from "./tron/firestore";
import { getCurrentUser } from "./tron/session";

export const db = localDb;

export const auth = {
  get currentUser() {
    return getCurrentUser();
  },
};
