
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { uploadFile } from '@/lib/s3';
import { parsePoFile } from '@/lib/po-parser';

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sourceLang = formData.get('sourceLang') as string || 'en';

    if (!file) {
      return NextResponse.json({ error: 'Nincs fájl kiválasztva' }, { status: 400 });
    }

    if (!file.name.endsWith('.po')) {
      return NextResponse.json({ error: 'Csak .po fájlok engedélyezettek' }, { status: 400 });
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const content = buffer.toString('utf-8');

    // Parse .po file
    const parsedFile = parsePoFile(content);

    if (parsedFile.entries.length === 0) {
      return NextResponse.json({ error: 'A .po fájl nem tartalmaz fordítható bejegyzéseket' }, { status: 400 });
    }

    // Check for entries exceeding character limit
    const longEntries = parsedFile.entries.filter(entry => entry.characterCount > 4000);
    
    // Upload file to S3
    const cloudStoragePath = await uploadFile(buffer, file.name);

    // Create project in database
    const project = await prisma.translationProject.create({
      data: {
        fileName: file.name,
        originalFileName: file.name,
        sourceLang,
        status: 'parsing',
        totalEntries: parsedFile.entries.length,
        cloudStoragePath,
      }
    });

    // Create translation entries
    const entries = await Promise.all(
      parsedFile.entries.map(entry => 
        prisma.translationEntry.create({
          data: {
            projectId: project.id,
            lineNumber: entry.lineNumber,
            msgid: entry.msgid,
            msgstr: entry.msgstr,
            comment: entry.comment,
            characterCount: entry.characterCount,
            hasError: entry.characterCount > 4000,
            errorMessage: entry.characterCount > 4000 ? 'A szöveg túl hosszú (4000+ karakter)' : undefined
          }
        })
      )
    );

    // Update project status
    await prisma.translationProject.update({
      where: { id: project.id },
      data: { status: 'parsed' }
    });

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        fileName: project.fileName,
        totalEntries: project.totalEntries,
        longEntries: longEntries.length,
        sourceLang: project.sourceLang
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Hiba a fájl feltöltése során' }, 
      { status: 500 }
    );
  }
}
