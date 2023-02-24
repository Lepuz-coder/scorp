import { Body, Controller, Get, ParseIntPipe } from '@nestjs/common';
import { PostsService } from './posts.service';

@Controller('/api/posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get('/list-of-posts')
  getListOfPosts() {
    return this.postsService.getPosts(2, [1, 8, 2, 3, 4, 5]);
  }

  @Get('/mixed-feed-posts')
  get_mixed_feed_posts(
    @Body('userId') userId: number,
    @Body('cursor') cursor: string | null,
    @Body('count') count: number,
  ) {
    return this.postsService.get_mixed_feed_posts(userId, cursor, count);
  }
}
