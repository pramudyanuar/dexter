export interface SearchEngine {
  id: string;
  label: string;
  url: (query: string) => string;
}

/**
 * Engines that return plain HTML results without JavaScript. Several of them
 * block automated traffic from time to time (DuckDuckGo, Mojeek, Startpage and
 * Yandex did when this was written), so the list is user-selectable.
 */
export const SEARCH_ENGINES: readonly SearchEngine[] = [
  {
    id: 'bing',
    label: 'Bing',
    url: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    id: 'brave',
    label: 'Brave',
    url: (q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    id: 'yahoo',
    label: 'Yahoo',
    url: (q) => `https://search.yahoo.com/search?p=${encodeURIComponent(q)}`,
  },
  {
    id: 'ddg',
    label: 'DuckDuckGo',
    url: (q) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
  },
];

export const DEFAULT_ENGINE = SEARCH_ENGINES[0].id;
