export interface Resume {
  id: string;
  subject: string;
  body: string;
}

export interface JobEmail {
  id: string;
  subject: string;
  urls: string[];
  date: Date;
}
