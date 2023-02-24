import { BadRequestException, Injectable } from '@nestjs/common';
import { Post } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PostsService {
  constructor(private prismaService: PrismaService) {}

  async getPosts(userId: number, post_ids: number[]) {
    const posts = await this.prismaService.post.findMany({
      where: {
        id: {
          in: post_ids,
        },
      },
    });

    const likes = await this.prismaService.like.findMany({
      where: {
        post_id: {
          in: post_ids,
        },
      },
    });

    const userIdsOnPosts = posts.map((post) => post.user_id);

    const postUsers = await this.prismaService.user.findMany({
      where: {
        id: {
          in: userIdsOnPosts,
        },
      },
    });

    const postUserIds = postUsers.map((user) => user.id);

    const postUserFollowers = await this.prismaService.follow.findMany({
      where: {
        following_id: {
          in: postUserIds,
        },
      },
    });

    const finalPosts = [];

    post_ids.forEach((id) => {
      const post = posts.find((post) => post.id === id);

      if (!post) {
        finalPosts.push(null);
        return;
      }

      const postUser = postUsers.find((user) => user.id === post.user_id);

      const isFollowing = postUserFollowers.find(
        (follower) =>
          follower.following_id === postUser.id &&
          follower.follower_id === userId,
      );

      const isLiked = likes.find(
        (like) => like.post_id === post.id && like.user_id === userId,
      );

      finalPosts.push({
        posts: {
          id: post.id,
          description: post.description,
          owner: {
            id: postUser.id,
            username: postUser.username,
            full_name: postUser.full_name,
            profile_picture: postUser.profile_picture,
            followed: isFollowing ? true : false,
          },
          image: post.image,
          created_at: post.created_at,
          liked: isLiked ? true : false,
        },
      });
    });

    return finalPosts;
  }

  //cursor is total taked result from previous request 1-5, 6-10, 11-15
  async get_mixed_feed_posts(
    userId: number,
    cursor: string | null,
    count: number,
  ) {
    let ownedPostCount = Math.ceil(count / 2);
    let likedPostCount = count - ownedPostCount;

    let ownedPostSkip: number | null = 0;
    let likedPostSkip: number | null = 0;

    if (cursor) {
      if (cursor.split('-').length !== 2) {
        throw new BadRequestException('cursor is not valid');
      }

      ownedPostSkip =
        cursor.split('-')[0] === 'null' ? null : +cursor.split('-')[0];
      likedPostSkip =
        cursor.split('-')[1] === 'null' ? null : +cursor.split('-')[1];

      if (ownedPostSkip !== null && Number.isNaN(ownedPostSkip)) {
        throw new BadRequestException('cursor is not valid');
      }

      if (likedPostSkip !== null && Number.isNaN(likedPostSkip)) {
        throw new BadRequestException('cursor is not valid');
      }
    }

    const userLikes = await this.prismaService.like.findMany({
      where: {
        user_id: userId,
      },
    });

    let likedPosts: Post[] = [];

    if (likedPostSkip !== null) {
      likedPosts = await this.prismaService.post.findMany({
        where: {
          id: {
            in: userLikes.map((like) => like.post_id),
          },
        },
        take: likedPostCount,
        skip: likedPostSkip,
        orderBy: {
          id: 'desc',
        },
      });
    }

    if (likedPostCount !== likedPosts.length) {
      ownedPostCount = count - likedPosts.length;
    }

    let ownedPosts: Post[] = [];

    if (ownedPostSkip !== null) {
      ownedPosts = await this.prismaService.post.findMany({
        where: {
          user_id: userId,
          id: {
            notIn: likedPosts.map((post) => post.id),
          },
        },
        take: ownedPostCount,
        skip: ownedPostSkip,
        orderBy: {
          id: 'desc',
        },
      });
    }

    const postUsers = await this.prismaService.user.findMany({
      where: {
        id: {
          in: [
            ...likedPosts.map((post) => post.user_id),
            ...ownedPosts.map((post) => post.user_id),
          ],
        },
      },
    });

    const finalPosts = [];
    let ownedCounter = 0;
    let likedCounter = 0;

    for (let i = 0; i < count; i++) {
      let post;

      if ((i + 1) % 2 === 0 && likedCounter < likedPosts.length) {
        post = likedPosts[likedCounter];
        likedCounter++;
      } else if (ownedCounter < ownedPosts.length) {
        post = ownedPosts[ownedCounter];
        ownedCounter++;
      }

      if (post) {
        const postUser = postUsers.find((user) => user.id === post.user_id);

        finalPosts.push({
          id: post.id,
          description: post.description,
          owner: {
            id: postUser.id,
            username: postUser.username,
            full_name: postUser.full_name,
            profile_picture: postUser.profile_picture,
          },
        });
      }
    }

    const totalOwnedPosts = await this.prismaService.post.count({
      where: {
        user_id: userId,
      },
    });

    const totalLikedPosts = await this.prismaService.post.count({
      where: {
        id: {
          in: userLikes.map((like) => like.post_id),
        },
      },
    });

    const totalOwnedTaked =
      ownedPostSkip === null ? totalOwnedPosts : ownedPostSkip + ownedPostCount;
    const totalLikedTaked =
      likedPostSkip === null ? totalLikedPosts : likedPostSkip + likedPostCount;

    let finalCursor = `${
      totalOwnedTaked >= totalOwnedPosts ? 'null' : totalOwnedTaked
    }-${totalLikedTaked >= totalLikedPosts ? 'null' : totalLikedTaked}`;

    const totalTakedPost = totalOwnedTaked + totalLikedTaked;

    if (totalTakedPost >= totalOwnedPosts + totalLikedPosts) {
      finalCursor = null;
    }

    return {
      posts: finalPosts,
      cursor: finalCursor,
    };
  }
}
