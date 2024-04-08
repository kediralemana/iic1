// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Injectable } from '@angular/core';
import { CoreCourseActivitySyncBaseProvider } from '@features/course/classes/activity-sync';
import { CoreFileUploader } from '@features/fileuploader/services/fileuploader';
import { CoreFileEntry } from '@services/file-helper';
import { CoreSites, CoreSitesReadingStrategy } from '@services/sites';
import { CoreSyncResult } from '@services/sync';
import { CoreDomUtils } from '@services/utils/dom';
import { makeSingleton } from '@singletons';
import { CoreEvents } from '@singletons/events';
import { ADDON_BLOG_ENTRY_UPDATED } from '../constants';
import { AddonBlog, AddonBlogAddEntryOption } from './blog';
import { AddonBlogOffline } from './blog-offline';
import { AddonBlogOfflineEntryDBRecord } from './database/blog';

/**
 * Service to sync blog.
 */
 @Injectable({ providedIn: 'root' })
 export class AddonBlogSyncProvider extends CoreCourseActivitySyncBaseProvider<AddonBlogSyncResult> {

    static readonly AUTO_SYNCED = 'addon_mod_blog_autom_synced';
    static readonly MANUAL_SYNCED = 'addon_mod_blog_manual_synced';

    protected componentTranslatableString = 'blog';

    constructor() {
        super('AddonModBlogSyncService');
    }

     /**
      * Try to synchronize all the entries in a certain site or in all sites.
      *
      * @param siteId Site ID to sync. If not defined, sync all sites.
      * @param force Force sync.
      * @returns Promise resolved if sync is successful, rejected if sync fails.
      */
    async syncAllEntries(siteId?: string, force?: boolean): Promise<void> {
        const site = await CoreSites.getSite(siteId);
        await this.syncAllEntriesFunc(!!force, site.id);
    }

    /**
     * Sync all entries on a site.
     *
     * @param force Force sync.
     * @param siteId Site ID to sync.
     * @returns Promise resolved if sync is successful, rejected if sync fails.
     */
    protected async syncAllEntriesFunc(force: boolean, siteId: string): Promise<void> {
        const entriesToBeSynced = await AddonBlogOffline.getOfflineEntries(siteId);
        const syncId = this.getBlogSyncId();
        const needed = await this.isSyncNeeded(syncId, siteId);

        if (!entriesToBeSynced.length || (!force && !needed)) {
            return;
        }

        for (const entry of entriesToBeSynced) {
            const formattedEntry = {
                subject: entry.subject,
                summary: entry.summary,
                summaryformat: entry.summaryformat,
                options: JSON.parse(entry.options),
                created: entry.created,
            };

            try {
                switch (entry.action) {
                    case 'created':
                        await this.uploadAttachments(formattedEntry.created);
                        await Promise.all([
                            AddonBlog.addEntry(formattedEntry),
                            AddonBlogOffline.deleteOfflineEntryRecord(entry.created),
                        ]);
                        CoreEvents.trigger(ADDON_BLOG_ENTRY_UPDATED);
                        break;

                    case 'removed':
                        await Promise.all([
                            AddonBlog.deleteEntry({ entryid: entry.id }),
                            AddonBlogOffline.deleteOfflineEntryRecord(entry.created),
                        ]);
                        CoreEvents.trigger(ADDON_BLOG_ENTRY_UPDATED);
                        break;

                    case 'updated':
                        await this.updateOfflineEntry({ ...entry, options: JSON.parse(entry.options) });
                        CoreEvents.trigger(ADDON_BLOG_ENTRY_UPDATED);
                        break;

                    default:
                        return;
                }
            } catch (error) {
                CoreDomUtils.showErrorModalDefault(error, 'An error has occourred when sync blog entries.');
            }
        }
    }

    /**
     * Update offline blog entry.
     *
     * @param entry Entry to update.
     * @param siteId Site ID.
     */
    protected async updateOfflineEntry(
        entry: AddonBlogOfflineEntryDBRecord & { options: AddonBlogAddEntryOption[] },
        siteId?: string,
    ): Promise<void> {
        const { attachmentsid } = await AddonBlog.prepareEntryForEdition({ entryid: entry.id }, siteId);
        await this.uploadAttachments(entry.id, attachmentsid);
        const optionsAttachmentsId = entry.options.find(option => option.name === 'attachmentsid');

        if (optionsAttachmentsId) {
            optionsAttachmentsId.value = attachmentsid;
        } else {
            entry.options.push({ name: 'attachmentsid', value: attachmentsid });
        }

        await AddonBlog.updateEntry({
            options: entry.options,
            subject: entry.subject,
            summary: entry.summary,
            summaryformat: entry.summaryformat,
            created: entry.created,
            entryid: entry.id,
        }, siteId);

        await AddonBlogOffline.deleteOfflineEntryRecord(entry.created);
    }

    /**
     * Upload attachments.
     *
     * @param folder Folder that contains the files.
     */
    protected async uploadAttachments(folder: number, attachmentsid?: number): Promise<void> {
        try {
            const files = await this.getOfflineFiles(folder);

            if (!files.length) {
                return;
            }

            const { entries } = await AddonBlog.getEntries(
                { entryid: folder },
                { readingStrategy: CoreSitesReadingStrategy.PREFER_NETWORK },
            );

            const selectedEntry = entries.find(entry => entry.id === folder);

            await CoreFileUploader.uploadFiles(
                attachmentsid ?? folder,
                selectedEntry?.attachmentfiles
                    ? files.concat(selectedEntry.attachmentfiles)
                    : files,
            );
        } catch (err) {
            CoreDomUtils.showErrorModalDefault(err, 'Error uploading files.');
            throw err;
        }
    }

    /**
     * Retrieve a list of offline files stored.
     *
     * @param id Entry id.
     * @returns Offline files for the provided entry id.
     */
    async getOfflineFiles(id: number): Promise<CoreFileEntry[]> {
        const folderPath = await AddonBlogOffline.getOfflineEntryFilesFolderPath(id);

        return await CoreFileUploader.getStoredFiles(folderPath);
    }

    /**
     * Get blog sync id.
     *
     * @param userId User the responses belong to.. If not defined, current user.
     * @returns Sync ID.
     */
    getBlogSyncId(userId?: number): string {
       userId = userId || CoreSites.getCurrentSiteUserId();

       return 'blogentry#' + userId;
    }

}

export const AddonBlogSync = makeSingleton(AddonBlogSyncProvider);

export type AddonBlogSyncResult = CoreSyncResult;
