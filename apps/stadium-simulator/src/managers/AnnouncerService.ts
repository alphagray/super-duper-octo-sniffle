import axios from 'axios';

export class AnnouncerService {
  private apiEndpoint: string;

  constructor() {
    // Use serverless function endpoint (local dev or production)
    this.apiEndpoint = import.meta.env.VITE_API_ENDPOINT || '/api/announcer';
  }

  public async getCommentary(gameContext: string): Promise<string> {
    try {
      const response = await axios.post(
        this.apiEndpoint,
        { gameContext },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data.commentary;
    } catch (error) {
      console.error('Failed to fetch announcer commentary:', error);
      return 'The crowd goes wild!';
    }
  }
}
