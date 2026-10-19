import { describe, expect, it } from 'vitest';
import { trafficSource } from './source';

const HOME = 'https://onemorecrypt.com/';

describe('traffic sources', () => {
  it('reads tagged links first', () => {
    expect(trafficSource(`${HOME}?ref=Discord`, 'https://www.reddit.com/r/x')).toEqual({ source: 'discord', host: '' });
    expect(trafficSource(`${HOME}?utm_source=ig-story`, '')).toEqual({ source: 'ig-story', host: '' });
  });

  it('groups referring sites under one name', () => {
    expect(trafficSource(HOME, 'https://out.reddit.com/t3_abc').source).toBe('reddit');
    expect(trafficSource(HOME, 'https://old.reddit.com/r/WebGames/').source).toBe('reddit');
    expect(trafficSource(HOME, 'https://t.co/xyz').source).toBe('x');
    expect(trafficSource(HOME, 'https://www.google.co.uk/').source).toBe('google');
    expect(trafficSource(HOME, 'https://duckduckgo.com/').source).toBe('search');
    expect(trafficSource(HOME, 'https://some-blog.net/post')).toEqual({ source: 'some-blog.net', host: 'some-blog.net' });
  });

  it('counts direct visits, the app and itch', () => {
    expect(trafficSource(HOME, '').source).toBe('direct');
    expect(trafficSource(HOME, 'https://onemorecrypt.com/#hall=bob').source).toBe('direct');
    expect(trafficSource(HOME, '', { app: true }).source).toBe('app');
    expect(trafficSource('https://html-classic.itch.zone/html/1/index.html', 'https://notjstn.itch.io/one-more-crypt', { itch: true }).source).toBe('itch');
  });
});
