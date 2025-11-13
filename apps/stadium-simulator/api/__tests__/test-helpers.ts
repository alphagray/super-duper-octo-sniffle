import type { VercelRequest, VercelResponse } from '@vercel/node';

export function createMockRequest(
  body: any,
  options: {
    method?: string;
    ip?: string;
  } = {}
): Partial<VercelRequest> {
  const { method = 'POST', ip = '127.0.0.1' } = options;
  
  return {
    method,
    body,
    headers: {
      'x-forwarded-for': ip,
      'content-type': 'application/json'
    }
  } as Partial<VercelRequest>;
}

export function createMockResponse() {
  const res: any = {
    statusCode: 200,
    headers: {},
    body: null
  };
  
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  
  res.json = (data: any) => {
    res.body = JSON.stringify(data);
    return res;
  };
  
  res.getStatusCode = () => res.statusCode;
  res.getData = () => res.body;
  
  return res as VercelResponse & {
    getStatusCode: () => number;
    getData: () => string;
  };
}
