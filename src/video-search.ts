import SemanticVideo, { FrameData } from "./semantic-video.js";

interface SearchResult {
  videoPath: string;
  frames: FrameData[];
}

/**
 * Handles search operations across videos
 */
class VideoSearch {
  /**
   * Searches across all videos for frames matching a keyword
   * @param keyword - The keyword to search for
   * @param videoIterator - Function to iterate over videos
   * @returns Array of results with video path and matching frames
   */
  searchAll(
    keyword: string,
    videoIterator: (callback: (video: SemanticVideo, path: string) => void) => void
  ): SearchResult[] {
    const results: SearchResult[] = [];

    videoIterator((video, videoPath) => {
      const matchingFrames = video.searchFrames(keyword);
      if (matchingFrames.length > 0) {
        results.push({
          videoPath,
          frames: matchingFrames,
        });
      }
    });

    return results;
  }

  /**
   * Searches a single video for frames matching a keyword
   * @param keyword - The keyword to search for
   * @param video - The video to search
   * @returns Array of matching frames
   */
  searchVideo(keyword: string, video: SemanticVideo): FrameData[] {
    return video.searchFrames(keyword);
  }
}

export default VideoSearch;
export type { SearchResult };
