import './conversation-authors.css';

import {CachedFunction} from 'webext-storage-cache';
import * as pageDetect from 'github-url-detection';

import features from '../feature-manager.js';
import api from '../github-helpers/api.js';
import {cacheByRepo, getUsername} from '../github-helpers/index.js';
import observe from '../helpers/selector-observer.js';
import {expectToken} from '../github-helpers/github-token.js';
import GetCollaborators from './conversation-authors.gql';

const collaborators = new CachedFunction('repo-collaborators', {
	async updater(): Promise<string[]> {
		const {repository} = await api.v4(GetCollaborators);
		return repository.collaborators.nodes.map((user: Record<string, string>) => user.login);
	},
	maxAge: {days: 1},
	staleWhileRevalidate: {days: 20},
	cacheKey: cacheByRepo,
});

async function highlightCollaborators(signal: AbortSignal): Promise<void> {
	await expectToken();
	const list = await collaborators.get();
	observe([
		// Old issue lists - TODO: Drop in 2026
		'.js-issue-row [data-hovercard-type="user"]',
		'a[class^="IssueItem-module__authorCreatedLink"]',
	], author => {
		if (list.includes(author.textContent.trim())) {
			author.classList.add('rgh-collaborator');
		}
	}, {signal});
}

function highlightSelf(signal: AbortSignal): void {
	// "Opened by {user}" and "Created by {user}"
	observe([
		// Old issue lists - TODO: Drop in 2026
		`.opened-by a[title$="ed by ${CSS.escape(getUsername()!)}"]`,
		`a[class^="IssueItem-module__authorCreatedLink"][data-hovercard-url="/users/${CSS.escape(getUsername()!)}/hovercard"]`,
	], author => {
		author.classList.add('rgh-collaborator');
		author.style.fontStyle = 'italic';
	}, {signal});
}

void features.add(import.meta.url, {
	include: [
		pageDetect.isRepoIssueOrPRList,
	],
	init: highlightCollaborators,
}, {
	include: [
		pageDetect.isIssueOrPRList,
	],
	init: highlightSelf,
});

/*

Test URLs:

https://github.com/issues
https://github.com/refined-github/refined-github/pulls

*/
