import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  findInventoryShortages,
  inventoryAvailabilityReason
} from '../services/inventoryAvailability.js';

const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const MENU_IMAGE_DIRECTORY = path.resolve(__dirname, '../../uploads/menu-items');

const menuQuerySchema = z.object({
  outlet: z.enum(['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA']).optional(),
  category: z.string().optional(),
  station: z.enum(['STEAM_LINE', 'GRILL_FRYER', 'ROLEX_GRIDDLE', 'BAR_BEVERAGE']).optional()
});

const menuItemSchema = z.object({
  outlet: z.enum(['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA']),
  name: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1).max(40),
  description: z.string().trim().max(280).optional(),
  priceUgx: z.number().positive().max(99_999_999.99),
  station: z.enum(['STEAM_LINE', 'GRILL_FRYER', 'ROLEX_GRIDDLE', 'BAR_BEVERAGE']),
  imageDataUrl: z.string().max(3_000_000).optional()
});

const menuItemUpdateSchema = menuItemSchema
  .omit({ outlet: true })
  .extend({
    removeImage: z.boolean().optional(),
    hideOriginalImage: z.boolean().optional()
  })
  .partial()
  .superRefine((value, context) => {
    if (value.imageDataUrl && value.removeImage) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Upload a replacement photo or remove the current photo, not both.'
      });
    }
    if (Object.keys(value).length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one menu field must be provided.'
      });
    }
  });

const availabilitySchema = z.object({
  isAvailable: z.boolean().optional(),
  is86: z.boolean().optional()
}).refine(data => data.isAvailable !== undefined || data.is86 !== undefined, {
  message: "Either isAvailable or is86 must be provided"
});

async function saveMenuImage(dataUrl: string): Promise<string> {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) {
    throw Object.assign(new Error('Choose a PNG, JPEG, or WebP image.'), { statusCode: 400 });
  }

  const [, format, encoded] = match;
  const image = Buffer.from(encoded, 'base64');
  if (!image.length || image.length > IMAGE_MAX_BYTES || image.toString('base64') !== encoded) {
    throw Object.assign(new Error('Meal images must be valid and no larger than 2 MB.'), {
      statusCode: 400
    });
  }

  const validSignature =
    (format === 'png' &&
      image.length >= 8 &&
      image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (format === 'jpeg' &&
      image.length >= 3 &&
      image[0] === 0xff &&
      image[1] === 0xd8 &&
      image[2] === 0xff) ||
    (format === 'webp' &&
      image.length >= 12 &&
      image.toString('ascii', 0, 4) === 'RIFF' &&
      image.toString('ascii', 8, 12) === 'WEBP');
  if (!validSignature) {
    throw Object.assign(new Error('The selected file is not a valid PNG, JPEG, or WebP image.'), {
      statusCode: 400
    });
  }

  const extension = format === 'jpeg' ? 'jpg' : format;
  const filename = `${randomUUID()}.${extension}`;
  await mkdir(MENU_IMAGE_DIRECTORY, { recursive: true });
  await writeFile(path.join(MENU_IMAGE_DIRECTORY, filename), image, { flag: 'wx' });
  return `/api/v1/menu-items/images/${filename}`;
}

async function removeMenuImage(imageUrl: string | null | undefined): Promise<void> {
  const filename = imageUrl?.match(/^\/api\/v1\/menu-items\/images\/([0-9a-f-]+\.(?:png|jpg|webp))$/i)?.[1];
  if (filename) {
    await unlink(path.join(MENU_IMAGE_DIRECTORY, filename)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

export const menuRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/menu-items
  fastify.get('/', async (request, reply) => {
    const { outlet, category, station } = menuQuerySchema.parse(request.query);

    const items = await fastify.prisma.menu_items.findMany({
      where: {
        ...(outlet && { outlet }),
        ...(category && { category }),
        ...(station && { station })
      },
      orderBy: { name: 'asc' },
      include: {
        recipe_boms: {
          include: { raw_material: true }
        }
      }
    });

    return reply.send({
      success: true,
      items: items.map((i) => {
        const shortages = findInventoryShortages(
          [i],
          new Map([[i.id, 1]]),
          i.outlet
        );
        const availabilityReason = inventoryAvailabilityReason(shortages);
        return {
          id: i.id,
          outlet: i.outlet,
          name: i.name,
          category: i.category,
          description: i.description,
          priceUgx: Number(i.price_ugx),
          station: i.station,
          imageUrl: i.image_url,
          hideOriginalImage: i.image_hidden,
          isActive: i.is_active,
          is86: i.is_86,
          isAvailable: i.is_active && !i.is_86 && !availabilityReason,
          availabilityReason
        };
      })
    });
  });

  fastify.get<{ Params: { filename: string } }>('/images/:filename', async (request, reply) => {
    const { filename } = request.params;
    if (!/^[0-9a-f-]+\.(?:png|jpg|webp)$/i.test(filename)) {
      return reply.status(404).send({ message: 'Meal image not found.' });
    }

    try {
      const image = await readFile(path.join(MENU_IMAGE_DIRECTORY, filename));
      const contentType = filename.endsWith('.png')
        ? 'image/png'
        : filename.endsWith('.webp')
          ? 'image/webp'
          : 'image/jpeg';
      return reply
        .header('Content-Type', contentType)
        .header('X-Content-Type-Options', 'nosniff')
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .send(image);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return reply.status(404).send({ message: 'Meal image not found.' });
      }
      throw error;
    }
  });

  fastify.post(
    '/',
    {
      bodyLimit: 3 * 1024 * 1024,
      preHandler: [fastify.requireRole(['MANAGER_ADMIN'])]
    },
    async (request, reply) => {
      const data = menuItemSchema.parse(request.body);
      if (!data.imageDataUrl) {
        return reply.status(400).send({ message: 'A meal photo is required when adding a menu item.' });
      }
      if (request.user?.outlet && request.user.outlet !== data.outlet) {
        return reply.status(403).send({ message: 'You can only manage meals for your assigned outlet.' });
      }

      const imageUrl = await saveMenuImage(data.imageDataUrl);
      try {
        const item = await fastify.prisma.menu_items.create({
          data: {
            outlet: data.outlet,
            name: data.name,
            category: data.category,
            description: data.description,
            price_ugx: data.priceUgx,
            station: data.station,
            image_url: imageUrl
          }
        });

        return reply.status(201).send({
          success: true,
          item: {
            id: item.id,
            outlet: item.outlet,
            name: item.name,
            category: item.category,
            description: item.description,
            priceUgx: Number(item.price_ugx),
            station: item.station,
            imageUrl: item.image_url,
            hideOriginalImage: item.image_hidden,
            isActive: item.is_active,
            is86: item.is_86,
            isAvailable: item.is_active && !item.is_86
          }
        });
      } catch (error) {
        await removeMenuImage(imageUrl);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          return reply.status(409).send({ message: 'A meal with this name already exists at this outlet.' });
        }
        throw error;
      }
    }
  );

  fastify.patch<{ Params: { id: string } }>(
    '/:id',
    {
      bodyLimit: 3 * 1024 * 1024,
      preHandler: [fastify.requireRole(['MANAGER_ADMIN'])]
    },
    async (request, reply) => {
      const { id } = request.params;
      const data = menuItemUpdateSchema.parse(request.body);
      const where = {
        id,
        ...(request.user?.outlet && { outlet: request.user.outlet })
      };
      const existing = await fastify.prisma.menu_items.findFirst({ where });
      if (!existing) {
        return reply.status(404).send({ message: 'Menu item not found in your outlet.' });
      }

      const imageUrl = data.imageDataUrl ? await saveMenuImage(data.imageDataUrl) : undefined;
      let updated;
      try {
        updated = await fastify.prisma.menu_items.update({
          where: { id: existing.id },
          data: {
            ...(data.name !== undefined && { name: data.name }),
            ...(data.category !== undefined && { category: data.category }),
            ...(data.description !== undefined && { description: data.description }),
            ...(data.priceUgx !== undefined && { price_ugx: data.priceUgx }),
            ...(data.station !== undefined && { station: data.station }),
            ...(imageUrl && { image_url: imageUrl }),
            ...(data.removeImage && { image_url: null }),
            ...(data.hideOriginalImage !== undefined && { image_hidden: data.hideOriginalImage })
          }
        });
      } catch (error) {
        if (imageUrl) await removeMenuImage(imageUrl);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          return reply.status(409).send({ message: 'A meal with this name already exists at this outlet.' });
        }
        throw error;
      }

      if ((imageUrl || data.removeImage) && existing.image_url) {
        try {
          await removeMenuImage(existing.image_url);
        } catch (error) {
          fastify.log.warn({ err: error, imageUrl: existing.image_url }, 'Could not remove replaced menu photo');
        }
      }

      return reply.send({
        success: true,
        item: {
          id: updated.id,
          outlet: updated.outlet,
          name: updated.name,
          category: updated.category,
          description: updated.description,
          priceUgx: Number(updated.price_ugx),
          station: updated.station,
          imageUrl: updated.image_url,
          hideOriginalImage: updated.image_hidden,
          isActive: updated.is_active,
          is86: updated.is_86,
          isAvailable: updated.is_active && !updated.is_86
        }
      });
    }
  );

  // PATCH /api/v1/menu-items/:id/availability (Staff only)
  fastify.patch<{ Params: { id: string }; Body: { isAvailable?: boolean; is86?: boolean } }>(
    '/:id/availability',
    { preHandler: [fastify.requireRole(['WAITER_FOH', 'KITCHEN_STAFF', 'MANAGER_ADMIN'])] },
    async (request, reply) => {
      const { id } = request.params;
      const { isAvailable, is86 } = availabilitySchema.parse(request.body);

      const targetIs86 = is86 !== undefined ? is86 : (isAvailable !== undefined ? !isAvailable : undefined);

      const existing = await fastify.prisma.menu_items.findUnique({
        where: { id },
        include: {
          recipe_boms: {
            include: { raw_material: true }
          }
        }
      });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          code: 'MENU_ITEM_NOT_FOUND',
          message: 'Menu item not found.'
        });
      }
      if (request.user!.outlet && request.user!.outlet !== existing.outlet) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: 'This meal belongs to another outlet.'
        });
      }

      const targetIsAvailable = isAvailable ?? (is86 !== undefined ? !is86 : undefined);
      if (targetIsAvailable) {
        const shortages = findInventoryShortages(
          [existing],
          new Map([[existing.id, 1]]),
          existing.outlet
        );
        if (shortages.length) {
          const availabilityReason = inventoryAvailabilityReason(shortages);
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            code: 'INSUFFICIENT_INGREDIENT_STOCK',
            message: `${existing.name} cannot be made available. ${availabilityReason}.`,
            shortages
          });
        }
      }

      const updated = await fastify.prisma.menu_items.update({
        where: { id: existing.id },
        data: {
          ...(targetIs86 !== undefined && { is_86: !targetIsAvailable! })
        }
      });

      const shortages = findInventoryShortages(
        [existing],
        new Map([[existing.id, 1]]),
        existing.outlet
      );
      const availabilityReason = inventoryAvailabilityReason(shortages);

      return reply.send({
        success: true,
        message: `Menu item ${updated.name} availability set to ${!updated.is_86 && !availabilityReason}`,
        item: {
          id: updated.id,
          outlet: updated.outlet,
          name: updated.name,
          category: updated.category,
          description: updated.description,
          priceUgx: Number(updated.price_ugx),
          station: updated.station,
          imageUrl: updated.image_url,
          hideOriginalImage: updated.image_hidden,
          isActive: updated.is_active,
          is86: updated.is_86,
          isAvailable: updated.is_active && !updated.is_86 && !availabilityReason,
          availabilityReason
        }
      });
    }
  );
};
