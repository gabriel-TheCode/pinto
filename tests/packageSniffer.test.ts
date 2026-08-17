/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { firstPackageIn, sniffPackageName } from '@/content/packageSniffer';

function page(html: string): Document {
  const doc = document.implementation.createHTMLDocument('test');
  doc.body.innerHTML = html;
  return doc;
}

describe('package name extraction', () => {
  it('prefers an explicit package-name affordance', () => {
    const doc = page(
      '<header><span aria-label="Package name: com.example.app">com.example.app</span></header>',
    );
    expect(sniffPackageName(doc)).toBe('com.example.app');
  });

  it('reads a data attribute', () => {
    const doc = page('<div data-package-name="com.acme.tool"></div>');
    expect(sniffPackageName(doc)).toBe('com.acme.tool');
  });

  it('falls back to text near the top of the page', () => {
    const doc = page('<header><h1>My App</h1><p>com.mycompany.myapp</p></header>');
    expect(sniffPackageName(doc)).toBe('com.mycompany.myapp');
  });

  it('returns null rather than a wrong guess when nothing looks like a package', () => {
    const doc = page('<header><h1>Subscriptions</h1></header>');
    expect(sniffPackageName(doc)).toBeNull();
  });
});

describe('candidate filtering', () => {
  it('ignores Google’s own domains', () => {
    expect(firstPackageIn('play.google.com gstatic.com')).toBeNull();
  });

  it('ignores asset filenames', () => {
    expect(firstPackageIn('main.bundle.js styles.css')).toBeNull();
  });

  it('requires at least two segments', () => {
    expect(firstPackageIn('appname')).toBeNull();
  });

  it('accepts a normal package name with underscores and digits', () => {
    expect(firstPackageIn('org.example_2.app3')).toBe('org.example_2.app3');
  });
});
