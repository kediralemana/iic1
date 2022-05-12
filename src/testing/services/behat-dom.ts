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

import { TestsBehatBlocking } from './behat-blocking';
import { TestBehatElementLocator } from './behat-runtime';

/**
 * Behat Dom Utils helper functions.
 */
export class TestsBehatDomUtils {

    /**
     * Check if an element is visible.
     *
     * @param element Element.
     * @param container Container.
     * @return Whether the element is visible or not.
     */
    static isElementVisible(element: HTMLElement, container: HTMLElement): boolean {
        if (element.getAttribute('aria-hidden') === 'true' || getComputedStyle(element).display === 'none') {
            return false;
        }

        const parentElement = this.getParentElement(element);
        if (parentElement === container) {
            return true;
        }

        if (!parentElement) {
            return false;
        }

        return this.isElementVisible(parentElement, container);
    }

    /**
     * Check if an element is selected.
     *
     * @param element Element.
     * @param container Container.
     * @return Whether the element is selected or not.
     */
    static isElementSelected(element: HTMLElement, container: HTMLElement): boolean {
        const ariaCurrent = element.getAttribute('aria-current');
        if (
            (ariaCurrent && ariaCurrent !== 'false') ||
            (element.getAttribute('aria-selected') === 'true') ||
            (element.getAttribute('aria-checked') === 'true')
        ) {
            return true;
        }

        const parentElement = this.getParentElement(element);
        if (!parentElement || parentElement === container) {
            return false;
        }

        return this.isElementSelected(parentElement, container);
    };

    /**
     * Finds elements within a given container with exact info.
     *
     * @param container Parent element to search the element within
     * @param text Text to look for
     * @return Elements containing the given text with exact boolean.
     */
    protected static findElementsBasedOnTextWithinWithExact(container: HTMLElement, text: string): ElementsWithExact[] {
        const attributesSelector = `[aria-label*="${text}"], a[title*="${text}"], img[alt*="${text}"]`;

        const elements = Array.from(container.querySelectorAll<HTMLElement>(attributesSelector))
            .filter((element => this.isElementVisible(element, container)))
            .map((element) => {
                const exact = this.checkElementLabel(element, text);

                return { element, exact };
            });

        const treeWalker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_DOCUMENT_FRAGMENT | NodeFilter.SHOW_TEXT,  // eslint-disable-line no-bitwise
            {
                acceptNode: node => {
                    if (node instanceof HTMLStyleElement ||
                        node instanceof HTMLLinkElement ||
                        node instanceof HTMLScriptElement) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    if (node instanceof HTMLElement &&
                        (node.getAttribute('aria-hidden') === 'true' || getComputedStyle(node).display === 'none')) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    return NodeFilter.FILTER_ACCEPT;
                },
            },
        );

        let currentNode: Node | null = null;
        // eslint-disable-next-line no-cond-assign
        while (currentNode = treeWalker.nextNode()) {
            if (currentNode instanceof Text) {
                if (currentNode.textContent?.includes(text) && currentNode.parentElement) {
                    elements.push({
                        element: currentNode.parentElement,
                        exact: currentNode.textContent.trim() === text,
                    });
                }

                continue;
            }

            if (currentNode instanceof HTMLElement) {
                const labelledBy = currentNode.getAttribute('aria-labelledby');
                const labelElement = labelledBy && container.querySelector<HTMLElement>(`#${labelledBy}`);
                if (labelElement && labelElement.innerText && labelElement.innerText.includes(text)) {
                    elements.push({
                        element: currentNode,
                        exact: labelElement.innerText.trim() == text,
                    });

                    continue;
                }
            }

            if (currentNode instanceof Element && currentNode.shadowRoot) {
                for (const childNode of Array.from(currentNode.shadowRoot.childNodes)) {
                    if (!(childNode instanceof HTMLElement) || (
                        childNode instanceof HTMLStyleElement ||
                        childNode instanceof HTMLLinkElement ||
                        childNode instanceof HTMLScriptElement)) {
                        continue;
                    }

                    if (childNode.matches(attributesSelector)) {
                        elements.push({
                            element: childNode,
                            exact: this.checkElementLabel(childNode, text),
                        });

                        continue;
                    }

                    elements.push(...this.findElementsBasedOnTextWithinWithExact(childNode, text));
                }
            }
        }

        return elements;
    };

    /**
     * Checks an element has exactly the same label (title, alt or aria-label).
     *
     * @param element Element to check.
     * @param text Text to check.
     * @return If text matches any of the label attributes.
     */
    protected static checkElementLabel(element: HTMLElement, text: string): boolean {
        return element.title === text ||
            element.getAttribute('alt') === text ||
            element.getAttribute('aria-label') === text;
    }

    /**
     * Finds elements within a given container.
     *
     * @param container Parent element to search the element within.
     * @param text Text to look for.
     * @return Elements containing the given text.
     */
    protected static findElementsBasedOnTextWithin(container: HTMLElement, text: string): HTMLElement[] {
        const elements = this.findElementsBasedOnTextWithinWithExact(container, text);

        // Give more relevance to exact matches.
        elements.sort((a, b) => Number(b.exact) - Number(a.exact));

        return elements.map(element => element.element);
    };

    /**
     * Given a list of elements, get the top ancestors among all of them.
     *
     * This will remote duplicates and drop any elements nested within each other.
     *
     * @param elements Elements list.
     * @return Top ancestors.
     */
    protected static getTopAncestors(elements: HTMLElement[]): HTMLElement[] {
        const uniqueElements = new Set(elements);

        for (const element of uniqueElements) {
            for (const otherElement of uniqueElements) {
                if (otherElement === element) {
                    continue;
                }

                if (element.contains(otherElement)) {
                    uniqueElements.delete(otherElement);
                }
            }
        }

        return Array.from(uniqueElements);
    };

    /**
     * Get parent element, including Shadow DOM parents.
     *
     * @param element Element.
     * @return Parent element.
     */
    protected static getParentElement(element: HTMLElement): HTMLElement | null {
        return element.parentElement ||
            (element.getRootNode() && (element.getRootNode() as ShadowRoot).host as HTMLElement) ||
            null;
    }

    /**
     * Get closest element matching a selector, without traversing up a given container.
     *
     * @param element Element.
     * @param selector Selector.
     * @param container Topmost container to search within.
     * @return Closest matching element.
     */
    protected static getClosestMatching(element: HTMLElement, selector: string, container: HTMLElement | null): HTMLElement | null {
        if (element.matches(selector)) {
            return element;
        }

        if (element === container || !element.parentElement) {
            return null;
        }

        return this.getClosestMatching(element.parentElement, selector, container);
    };

    /**
     * Function to find top container element.
     *
     * @param containerName Whether to search inside the a container name.
     * @return Found top container element.
     */
    protected static getCurrentTopContainerElement(containerName: string): HTMLElement | null {
        let topContainer: HTMLElement | null = null;
        let containers: HTMLElement[] = [];
        const nonImplementedSelectors =
            'ion-alert, ion-popover, ion-action-sheet, ion-modal, core-user-tours-user-tour.is-active, page-core-mainmenu, ion-app';

        switch (containerName) {
            case 'html':
                containers = Array.from(document.querySelectorAll<HTMLElement>('html'));
                break;
            case 'toast':
                containers = Array.from(document.querySelectorAll('ion-app ion-toast.hydrated'));
                containers = containers.map(container => container?.shadowRoot?.querySelector('.toast-container') || container);
                break;
            case 'alert':
                containers = Array.from(document.querySelectorAll('ion-app ion-alert.hydrated'));
                break;
            case 'action-sheet':
                containers = Array.from(document.querySelectorAll('ion-app ion-action-sheet.hydrated'));
                break;
            case 'modal':
                containers = Array.from(document.querySelectorAll('ion-app ion-modal.hydrated'));
                break;
            case 'popover':
                containers = Array.from(document.querySelectorAll('ion-app ion-popover.hydrated'));
                break;
            case 'user-tour':
                containers = Array.from(document.querySelectorAll('core-user-tours-user-tour.is-active'));
                break;
            default:
                // Other containerName or not implemented.
                containers = Array.from(document.querySelectorAll<HTMLElement>(nonImplementedSelectors));
        }

        if (containers.length > 0) {
            // Get the one with more zIndex.
            topContainer =
                containers.reduce((a, b) => getComputedStyle(a).zIndex > getComputedStyle(b).zIndex ? a : b, containers[0]);
        }

        if (!topContainer) {
            return null;
        }

        if (containerName == 'page' || containerName == 'split-view content') {
            // Find non hidden pages inside the container.
            let pageContainers = Array.from(topContainer.querySelectorAll<HTMLElement>('.ion-page:not(.ion-page-hidden)'));
            pageContainers = pageContainers.filter((page) => !page.closest('.ion-page.ion-page-hidden'));

            if (pageContainers.length > 0) {
                // Get the more general one to avoid failing.
                topContainer = pageContainers[0];
            }

            if (containerName == 'split-view content') {
                topContainer = topContainer.querySelector<HTMLElement>('core-split-view ion-router-outlet');
            }
        }

        return topContainer;
    };

    /**
     * Function to find element based on their text or Aria label.
     *
     * @param locator Element locator.
     * @param containerName Whether to search only inside a specific container.
     * @return First found element.
     */
    static findElementBasedOnText(locator: TestBehatElementLocator, containerName = ''): HTMLElement {
        return this.findElementsBasedOnText(locator, containerName)[0];
    }

    /**
     * Function to find elements based on their text or Aria label.
     *
     * @param locator Element locator.
     * @param containerName Whether to search only inside a specific container.
     * @return Found elements
     */
    protected static findElementsBasedOnText(locator: TestBehatElementLocator, containerName = ''): HTMLElement[] {
        let topContainer = this.getCurrentTopContainerElement(containerName);

        let container = topContainer;

        if (locator.within) {
            const withinElements = this.findElementsBasedOnText(locator.within);

            if (withinElements.length === 0) {
                throw new Error('There was no match for within text');
            } else if (withinElements.length > 1) {
                const withinElementsAncestors = this.getTopAncestors(withinElements);

                if (withinElementsAncestors.length > 1) {
                    throw new Error('Too many matches for within text');
                }

                topContainer = container = withinElementsAncestors[0];
            } else {
                topContainer = container = withinElements[0];
            }
        }

        if (topContainer && locator.near) {
            const nearElements = this.findElementsBasedOnText(locator.near);

            if (nearElements.length === 0) {
                throw new Error('There was no match for near text');
            } else if (nearElements.length > 1) {
                const nearElementsAncestors = this.getTopAncestors(nearElements);

                if (nearElementsAncestors.length > 1) {
                    throw new Error('Too many matches for near text');
                }

                container = this.getParentElement(nearElementsAncestors[0]);
            } else {
                container = this.getParentElement(nearElements[0]);
            }
        }

        do {
            if (!container) {
                break;
            }

            const elements = this.findElementsBasedOnTextWithin(container, locator.text);

            let filteredElements: HTMLElement[] = elements;

            if (locator.selector) {
                filteredElements = [];
                const selector = locator.selector;

                elements.forEach((element) => {
                    const closest = this.getClosestMatching(element, selector, container);
                    if (closest) {
                        filteredElements.push(closest);
                    }
                });
            }

            if (filteredElements.length > 0) {
                return filteredElements;
            }

        } while (container !== topContainer && (container = this.getParentElement(container)) && container !== topContainer);

        return [];
    };

    /**
     * Make sure that an element is visible and wait to trigger the callback.
     *
     * @param element Element.
     * @param callback Callback called when the element is visible, passing bounding box parameter.
     */
    protected static ensureElementVisible(element: HTMLElement, callback: (rect: DOMRect) => void): void {
        const initialRect = element.getBoundingClientRect();

        element.scrollIntoView(false);

        requestAnimationFrame(() => {
            const rect = element.getBoundingClientRect();

            if (initialRect.y !== rect.y) {
                setTimeout(() => {
                    callback(rect);
                }, 300);

                TestsBehatBlocking.delay();

                return;
            }

            callback(rect);
        });

        TestsBehatBlocking.delay();
    };

    /**
     * Press an element.
     *
     * @param element Element to press.
     */
    static pressElement(element: HTMLElement): void {
        this.ensureElementVisible(element, (rect) => {
            // Simulate a mouse click on the button.
            const eventOptions = {
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2,
                bubbles: true,
                view: window,
                cancelable: true,
            };

            // Events don't bubble up across Shadow DOM boundaries, and some buttons
            // may not work without doing this.
            const parentElement = this.getParentElement(element);

            if (parentElement && parentElement.matches('ion-button, ion-back-button')) {
                element = parentElement;
            }

            // There are some buttons in the app that don't respond to click events, for example
            // buttons using the core-supress-events directive. That's why we need to send both
            // click and mouse events.
            element.dispatchEvent(new MouseEvent('mousedown', eventOptions));

            setTimeout(() => {
                element.dispatchEvent(new MouseEvent('mouseup', eventOptions));
                element.click();
            }, 300);

            // Mark busy until the button click finishes processing.
            TestsBehatBlocking.delay();
        });
    }

}

type ElementsWithExact = {
    element: HTMLElement;
    exact: boolean;
};