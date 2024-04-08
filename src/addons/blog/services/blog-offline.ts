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
import { CoreFile } from '@services/file';
import { CoreSites } from '@services/sites';
import { makeSingleton } from '@singletons';
import { CorePath } from '@singletons/path';
import { AddonBlogOfflineEntryDBRecord, OFFLINE_BLOG_ENTRIES_TABLE_NAME } from './database/blog';

/**
 * Service to handle offline blog.
 */
@Injectable({ providedIn: 'root' })
export class AddonBlogOfflineService {

    /**
     * Delete an offline entry.
     *
     * @param created Entry creation date.
     * @param siteId Site ID. If not defined, current site.
     * @returns Promise resolved if deleted, rejected if failure.
     */
    async deleteOfflineEntryRecord(created: number, siteId?: string): Promise<void> {
        const site = await CoreSites.getSite(siteId);
        await site.getDb().deleteRecords(OFFLINE_BLOG_ENTRIES_TABLE_NAME, { created });
    }

    /**
     * Save an offline entry to be sent later.
     *
     * @param entry Entry.
     * @param siteId Site ID.
     *
     * @returns Promise resolved if stored, rejected if failure.
     */
    async deleteOfflineEntry(entry: Partial<AddonBlogOfflineEntryDBRecord>, siteId?: string): Promise<void> {
        const site = await CoreSites.getSite(siteId);
        await site.getDb().insertRecord(OFFLINE_BLOG_ENTRIES_TABLE_NAME, entry);
    }

    /**
     * Get a stored offline entry.
     *
     * @param entryId Entry ID.
     * @param timeCreated Entry creation time.
     * @param siteId Site ID. If not defined, current site.
     * @returns Promise resolved with entry.
     */
    async getOfflineEntry(entryId: number, timeCreated: number, siteId?: string): Promise<AddonBlogOfflineEntryDBRecord> {
        const site = await CoreSites.getSite(siteId);
        const conditions: Partial<AddonBlogOfflineEntryDBRecord> = { id: entryId, created: timeCreated };

        return await site.getDb().getRecord<AddonBlogOfflineEntryDBRecord>(OFFLINE_BLOG_ENTRIES_TABLE_NAME, conditions);
    }

    /**
     * Save an offline entry to be sent later.
     *
     * @param entry Entry.
     * @param siteId Site ID.
     *
     * @returns Promise resolved if stored, rejected if failure.
     */
    async addOfflineEntry(entry: Omit<AddonBlogOfflineEntryDBRecord, 'id'>, siteId?: string): Promise<void> {
        const site = await CoreSites.getSite(siteId);
        await site.getDb().insertRecord(OFFLINE_BLOG_ENTRIES_TABLE_NAME, entry);
    }

    /**
     * Update an offline entry to be sent later.
     *
     * @param entry Entry updated data.
     */
    async updateOfflineEntry(entry: AddonBlogOfflineEntryDBRecord, siteId?: string): Promise<void> {
        const site = await CoreSites.getSite(siteId);
        await site.getDb().insertRecord(OFFLINE_BLOG_ENTRIES_TABLE_NAME, entry);
    }

    /**
     * Retrieves if there are any offline entry.
     *
     * @returns Has offline entries.
     */
    async getOfflineEntries(siteId?: string): Promise<AddonBlogOfflineEntryDBRecord[]> {
        const site = await CoreSites.getSite(siteId);

        return await site.getDb().getAllRecords<AddonBlogOfflineEntryDBRecord>(OFFLINE_BLOG_ENTRIES_TABLE_NAME);
    }

    /**
     * Get offline entry files folder path.
     *
     * @param folder Folder name.
     * @returns path.
     */
    async getOfflineEntryFilesFolderPath(folder: number | string): Promise<string> {
        const site = await CoreSites.getSite();
        const siteFolderPath = CoreFile.getSiteFolder(site.getId());

        return CorePath.concatenatePaths(siteFolderPath, 'blog-offlineentry/' + folder);
    }

}

export const AddonBlogOffline = makeSingleton(AddonBlogOfflineService);
