import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, DBNotification } from "@/lib/db";
import { readSessionUserId } from "@/lib/session";

async function getSessionUser() {
  const cookieStore = await cookies();
  const userId = readSessionUserId(cookieStore);
  if (!userId) return null;
  return await db.getUserById(userId);
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role === "admin") {
      const [allNotifs, allUsers] = await Promise.all([db.getNotifications(), db.getUsers()]);
      const usersById = new Map(allUsers.map((usr) => [usr.id, usr]));
      // Join with user names for admin console convenience
      const enrichedNotifs = allNotifs
        .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
        .map((n) => {
          const u = usersById.get(n.userId);
          return {
            ...n,
            userName: u?.name || "Unknown User",
            userEmail: u?.email || "N/A",
          };
        });
      return NextResponse.json({ success: true, notifications: enrichedNotifs });
    }

    const myNotifs = (await db.getNotificationsByUserId(user.id)).sort(
      (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
    );
    return NextResponse.json({ success: true, notifications: myNotifs });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { targetUserId, title, message, type, channel } = body;

    if (!title || !message) {
      return NextResponse.json({ error: "Required fields: title, message." }, { status: 400 });
    }

    const createdNotifications: DBNotification[] = [];
    const isAdmin = user.role === "admin";
    const resolvedTargetUserId = targetUserId || user.id;

    if (!isAdmin && resolvedTargetUserId !== user.id) {
      return NextResponse.json({ error: "Forbidden: users can only create their own notifications." }, { status: 403 });
    }

    if (resolvedTargetUserId === "all") {
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden: Admin privileges required." }, { status: 403 });
      }
      const users = await db.getUsers();
      for (const u of users) {
        const newNotif: DBNotification = {
          id: "notif-" + Math.random().toString(36).substring(2, 11),
          userId: u.id,
          title,
          message,
          type: type || "info",
          channel: channel || "in_app",
          status: "sent",
          read: false,
          sentAt: new Date().toISOString(),
        };
        await db.saveNotification(newNotif);
        createdNotifications.push(newNotif);
      }
    } else {
      const userExists = await db.getUserById(resolvedTargetUserId);
      if (!userExists) {
        return NextResponse.json({ error: "Target user not found." }, { status: 404 });
      }

      const newNotif: DBNotification = {
        id: "notif-" + Math.random().toString(36).substring(2, 11),
        userId: resolvedTargetUserId,
        title,
        message,
        type: type || "info",
        channel: channel || "in_app",
        status: "sent",
        read: false,
        sentAt: new Date().toISOString(),
      };
      await db.saveNotification(newNotif);
      createdNotifications.push(newNotif);
    }

    return NextResponse.json({ success: true, count: createdNotifications.length });
  } catch (error: any) {
    console.error("Notifications POST error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, read } = body;

    if (!id) {
      return NextResponse.json({ error: "Notification ID is required." }, { status: 400 });
    }

    const notifs = await db.getNotifications();
    const index = notifs.findIndex((n) => n.id === id);
    if (index === -1) {
      return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    }

    const notif = notifs[index];
    if (notif.userId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Access denied." }, { status: 403 });
    }

    if (read !== undefined) notif.read = !!read;
    await db.saveNotification(notif);

    return NextResponse.json({ success: true, notification: notif });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
