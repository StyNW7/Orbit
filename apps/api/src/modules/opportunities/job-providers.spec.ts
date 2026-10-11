import { httpUrl } from './job-providers';

describe('httpUrl', () => {
  it('keeps http and https links', () => {
    expect(httpUrl('https://remotive.com/jobs/1')).toBe('https://remotive.com/jobs/1');
    expect(httpUrl('  http://example.com/a?b=1 ')).toBe('http://example.com/a?b=1');
  });

  it('drops scriptable or non-web schemes', () => {
    expect(httpUrl('javascript:alert(1)')).toBeNull();
    expect(httpUrl('JaVaScRiPt:alert(1)')).toBeNull();
    expect(httpUrl('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
    expect(httpUrl('vbscript:msgbox')).toBeNull();
  });

  it('drops empty, relative and non-string values', () => {
    expect(httpUrl('')).toBeNull();
    expect(httpUrl('/jobs/1')).toBeNull();
    expect(httpUrl(undefined)).toBeNull();
    expect(httpUrl(42)).toBeNull();
  });
});
