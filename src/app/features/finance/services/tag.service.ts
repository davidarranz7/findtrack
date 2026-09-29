import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Tag } from '../models';

@Injectable({
  providedIn: 'root',
})
export class TagService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/tags';

  getTags(userId: string): Observable<Tag[]> {
    return this.http.get<Tag[]>(this.apiUrl, {
      params: { userId },
    });
  }
}
