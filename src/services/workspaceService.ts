/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GoogleDriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
  mimeType?: string;
}

export interface ExtractedDocContent {
  id: string;
  title: string;
  fullText: string;
  paragraphs: string[];
  lines: string[];
}

export interface ExtractedSlideContent {
  id: string;
  title: string;
  slides: {
    pageNumber: number;
    objectId: string;
    title: string;
    bodyText: string[];
    notes?: string;
  }[];
}

/**
 * List Google Docs from user's Google Drive
 */
export async function listGoogleDocs(accessToken: string): Promise<GoogleDriveFile[]> {
  try {
    const query = encodeURIComponent("mimeType = 'application/vnd.google-apps.document' and trashed = false");
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&pageSize=25&fields=files(id,name,modifiedTime,webViewLink)&orderBy=modifiedTime desc`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to fetch Google Docs (status ${res.status})`);
    }

    const data = await res.json();
    return data.files || [];
  } catch (err) {
    console.error('Error listing Google Docs:', err);
    throw err;
  }
}

/**
 * Fetch and extract text and paragraphs from a Google Doc
 */
export async function fetchGoogleDoc(accessToken: string, documentId: string): Promise<ExtractedDocContent> {
  try {
    const res = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to fetch Google Doc content (status ${res.status})`);
    }

    const doc = await res.json();
    const title = doc.title || 'Untitled Document';
    const paragraphs: string[] = [];

    // Parse Google Docs structural elements
    if (Array.isArray(doc.body?.content)) {
      for (const element of doc.body.content) {
        if (element.paragraph?.elements) {
          let paragraphText = '';
          for (const el of element.paragraph.elements) {
            if (el.textRun?.content) {
              paragraphText += el.textRun.content;
            }
          }
          const trimmed = paragraphText.trim();
          if (trimmed.length > 0) {
            paragraphs.push(trimmed);
          }
        }
      }
    }

    const fullText = paragraphs.join('\n');
    const lines = paragraphs.flatMap((p) =>
      p
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
    );

    return {
      id: documentId,
      title,
      fullText,
      paragraphs,
      lines,
    };
  } catch (err) {
    console.error(`Error loading Google Doc ${documentId}:`, err);
    throw err;
  }
}

/**
 * Create a new Google Doc with visualizer text / setlist (Requires user confirmation prior to call)
 */
export async function createGoogleDoc(
  accessToken: string,
  title: string,
  initialContent: string
): Promise<GoogleDriveFile> {
  try {
    // Step 1: Create empty document
    const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to create document');
    }

    const createdDoc = await createRes.json();
    const docId = createdDoc.documentId;

    // Step 2: Insert text content
    if (initialContent.trim().length > 0) {
      await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: initialContent + '\n',
              },
            },
          ],
        }),
      });
    }

    return {
      id: docId,
      name: title,
      webViewLink: `https://docs.google.com/document/d/${docId}/edit`,
    };
  } catch (err) {
    console.error('Error creating Google Doc:', err);
    throw err;
  }
}

/**
 * List Google Slides presentations from user's Google Drive
 */
export async function listGoogleSlides(accessToken: string): Promise<GoogleDriveFile[]> {
  try {
    const query = encodeURIComponent("mimeType = 'application/vnd.google-apps.presentation' and trashed = false");
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&pageSize=25&fields=files(id,name,modifiedTime,webViewLink)&orderBy=modifiedTime desc`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to fetch Google Slides (status ${res.status})`);
    }

    const data = await res.json();
    return data.files || [];
  } catch (err) {
    console.error('Error listing Google Slides:', err);
    throw err;
  }
}

/**
 * Fetch and extract slides, titles, and text from a Google Slides presentation
 */
export async function fetchGoogleSlidesPresentation(
  accessToken: string,
  presentationId: string
): Promise<ExtractedSlideContent> {
  try {
    const res = await fetch(`https://slides.googleapis.com/v1/presentations/${presentationId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to fetch presentation (status ${res.status})`);
    }

    const presentation = await res.json();
    const presentationTitle = presentation.title || 'Untitled Presentation';
    const slidesData: ExtractedSlideContent['slides'] = [];

    if (Array.isArray(presentation.slides)) {
      presentation.slides.forEach((slide: any, index: number) => {
        let slideTitle = `Slide ${index + 1}`;
        const bodyTexts: string[] = [];

        if (Array.isArray(slide.pageElements)) {
          for (const el of slide.pageElements) {
            const shape = el.shape;
            if (shape?.text?.textElements) {
              let text = '';
              for (const te of shape.text.textElements) {
                if (te.textRun?.content) {
                  text += te.textRun.content;
                }
              }
              const clean = text.trim();
              if (clean.length > 0) {
                if (shape.placeholder?.type === 'TITLE' || shape.placeholder?.type === 'CENTERED_TITLE') {
                  slideTitle = clean;
                } else {
                  bodyTexts.push(clean);
                }
              }
            }
          }
        }

        slidesData.push({
          pageNumber: index + 1,
          objectId: slide.objectId || `slide-${index + 1}`,
          title: slideTitle,
          bodyText: bodyTexts,
        });
      });
    }

    return {
      id: presentationId,
      title: presentationTitle,
      slides: slidesData,
    };
  } catch (err) {
    console.error(`Error loading Google Slides presentation ${presentationId}:`, err);
    throw err;
  }
}
