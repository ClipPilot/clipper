"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { adminAPI, Announcement, CreateAnnouncementData } from "@/lib/api";

const ITEMS_PER_PAGE = 10;

interface PreviewModalProps {
  title: string;
  content: string;
  priority: "info" | "warning" | "critical";
  icon?: string;
  actionLabel?: string;
  actionUrl?: string;
  onClose: () => void;
}

function PreviewModal({ title, content, priority, icon, actionLabel, actionUrl, onClose }: PreviewModalProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-500/20 border-red-500/30";
      case "warning":
        return "bg-yellow-500/20 border-yellow-500/30";
      case "info":
      default:
        return "bg-blue-500/20 border-blue-500/30";
    }
  };

  const getPriorityIconBg = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-500/10 text-red-400";
      case "warning":
        return "bg-yellow-500/10 text-yellow-400";
      case "info":
      default:
        return "bg-blue-500/10 text-blue-400";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "critical":
        return "⚠️";
      case "warning":
        return "ℹ️";
      case "info":
      default:
        return "🔔";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface border border-border-light rounded-2xl p-8 w-full max-w-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              👁️ Preview
            </h2>
            <p className="text-sm text-text-tertiary mt-1">
              This is how users will see the announcement
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-surface-elevated hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Preview Card - mimics user announcement card */}
        <div className={`bg-surface-elevated border-2 ${getPriorityColor(priority)} rounded-xl p-5 shadow-lg`}>
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className={`p-3 rounded-xl ${getPriorityIconBg(priority)} flex-shrink-0`}>
              <span className="text-3xl">{icon ? icon : getPriorityIcon(priority)}</span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-text-primary mb-3">
                {title || "Untitled Announcement"}
              </h3>
              {content ? (
                <div
                  className="text-text-secondary leading-relaxed announcement-content"
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              ) : (
                <p className="text-text-tertiary italic">No content yet...</p>
              )}
              {actionUrl && (
                <button className="mt-4 px-5 py-2.5 rounded-lg bg-emerald text-black font-semibold hover:bg-emerald-light transition-colors inline-flex items-center gap-2">
                  {actionLabel || "Learn More"}
                  <span>→</span>
                </button>
              )}
            </div>

            {/* Dismiss button (just for show) */}
            <button className="flex-shrink-0 w-8 h-8 rounded-lg hover:bg-surface-hover text-text-tertiary hover:text-text-secondary transition-colors flex items-center justify-center">
              ✕
            </button>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-border flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald animate-pulse"></div>
          <p className="text-xs text-text-tertiary">
            Live Preview • Users will see this in their notification inbox
          </p>
        </div>
      </div>
    </div>
  );
}

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
}

function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const wrapSelection = (before: string, after: string = before) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);

    onChange(newText);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const insertTag = (tag: string) => {
    wrapSelection(`<${tag}>`, `</${tag}>`);
  };

  const insertLink = () => {
    const url = prompt("Enter URL:");
    if (!url) return;
    wrapSelection('<a href="' + url + '" target="_blank" rel="noopener noreferrer">', '</a>');
  };

  const insertList = (type: 'ul' | 'ol') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const listTag = type === 'ul' ? '<ul>\n  <li>' : '<ol>\n  <li>';
    const closeTag = type === 'ul' ? '</li>\n</ul>' : '</li>\n</ol>';

    const newText = value.substring(0, start) + listTag + '</li>\n  <li>' + closeTag + value.substring(start);
    onChange(newText);
  };

  const insertLineBreak = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const newText = value.substring(0, start) + '<br>' + value.substring(start);
    onChange(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 4, start + 4);
    }, 0);
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-surface-elevated">
      {/* Toolbar */}
      <div className="flex gap-1 p-2 border-b border-border bg-surface-elevated">
        <button
          type="button"
          onClick={() => insertTag('p')}
          className="px-2 py-1 text-xs rounded hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors"
          title="Paragraph"
        >
          P
        </button>
        <button
          type="button"
          onClick={() => insertTag('h2')}
          className="px-2 py-1 text-xs rounded hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors font-bold"
          title="Heading 2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => insertTag('h3')}
          className="px-2 py-1 text-xs rounded hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors font-bold"
          title="Heading 3"
        >
          H3
        </button>
        <div className="w-px bg-border mx-1" />
        <button
          type="button"
          onClick={() => insertTag('strong')}
          className="px-2 py-1 text-xs rounded hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors font-bold"
          title="Bold"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => insertTag('em')}
          className="px-2 py-1 text-xs rounded hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors italic"
          title="Italic"
        >
          I
        </button>
        <div className="w-px bg-border mx-1" />
        <button
          type="button"
          onClick={insertLink}
          className="px-2 py-1 text-xs rounded hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors"
          title="Link"
        >
          🔗
        </button>
        <div className="w-px bg-border mx-1" />
        <button
          type="button"
          onClick={() => insertList('ul')}
          className="px-2 py-1 text-xs rounded hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors"
          title="Bullet List"
        >
          • List
        </button>
        <button
          type="button"
          onClick={() => insertList('ol')}
          className="px-2 py-1 text-xs rounded hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors"
          title="Numbered List"
        >
          1. List
        </button>
        <button
          type="button"
          onClick={insertLineBreak}
          className="px-2 py-1 text-xs rounded hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors"
          title="Line Break"
        >
          ↵
        </button>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 bg-surface-elevated text-text-primary outline-none font-mono text-sm resize-none"
        rows={10}
        placeholder="Just press Enter for new lines - they work automatically!

We've just launched dark mode! Toggle it in your settings.

Or use HTML tags:
<strong>Bold text</strong>
<em>Italic text</em>

Mix and match for the perfect announcement."
      />
    </div>
  );
}

interface AnnouncementModalProps {
  announcement?: Announcement | null;
  onClose: () => void;
  onSuccess: () => void;
}

function AnnouncementModal({ announcement, onClose, onSuccess }: AnnouncementModalProps) {
  const [title, setTitle] = useState(announcement?.title || "");
  const [content, setContent] = useState(announcement?.content || "");
  const [priority, setPriority] = useState<"info" | "warning" | "critical">(
    announcement?.priority || "info"
  );
  const [icon, setIcon] = useState(announcement?.icon || "");
  const [actionLabel, setActionLabel] = useState(announcement?.action_label || "");
  const [actionUrl, setActionUrl] = useState(announcement?.action_url || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const handleSubmit = async (e: React.FormEvent, shouldPublish = false) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const data: CreateAnnouncementData = {
        title,
        content,
        priority,
        icon: icon || undefined,
        action_label: actionLabel || undefined,
        action_url: actionUrl || undefined,
      };

      if (announcement) {
        await adminAPI.updateAnnouncement(announcement.id, data);
      } else {
        const result = await adminAPI.createAnnouncement(data);
        if (shouldPublish && result.announcement) {
          await adminAPI.publishAnnouncement(result.announcement.id);
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save announcement");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 overflow-y-auto" onClick={onClose}>
        <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-3xl my-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <h2 className="text-xl font-bold text-text-primary mb-4">
            {announcement ? "Edit Announcement" : "Create Announcement"}
          </h2>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                maxLength={255}
                className="w-full px-3 py-2.5 rounded-lg bg-surface-elevated border border-border focus:border-emerald outline-none text-text-primary"
                placeholder="New Feature: Dark Mode Support"
              />
              <p className="text-xs text-text-tertiary mt-1">{title.length}/255 characters</p>
            </div>

            {/* Rich Text Editor */}
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">
                Content <span className="text-red-400">*</span>
              </label>
              <div className="mb-2 p-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
                <p className="text-xs text-blue-400">
                  💡 <strong>Quick Tip:</strong> Press Enter for new lines (they work automatically!), select text to format with toolbar, or type HTML directly
                </p>
              </div>
              <RichTextEditor value={content} onChange={setContent} />
              <p className="text-xs text-text-tertiary mt-1">
                Supported HTML: &lt;p&gt;, &lt;h1-h6&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;a&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;li&gt;, &lt;br&gt;
              </p>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as "info" | "warning" | "critical")}
                className="w-full px-3 py-2.5 rounded-lg bg-surface-elevated border border-border focus:border-emerald outline-none text-text-primary"
              >
                <option value="info">Info (Blue)</option>
                <option value="warning">Warning (Yellow)</option>
                <option value="critical">Critical (Red)</option>
              </select>
            </div>

            {/* Icon */}
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">
                Icon (optional - emoji or text)
              </label>
              <input
                type="text"
                value={icon}
                onChange={e => setIcon(e.target.value)}
                maxLength={100}
                className="w-full px-3 py-2.5 rounded-lg bg-surface-elevated border border-border focus:border-emerald outline-none text-text-primary"
                placeholder="🚀 or leave blank for default"
              />
              <p className="text-xs text-text-tertiary mt-1">
                Use emoji or leave blank to use default priority icon
              </p>
            </div>

            {/* Call to Action */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">
                  CTA Button Label
                </label>
                <input
                  type="text"
                  value={actionLabel}
                  onChange={e => setActionLabel(e.target.value)}
                  maxLength={50}
                  className="w-full px-3 py-2.5 rounded-lg bg-surface-elevated border border-border focus:border-emerald outline-none text-text-primary"
                  placeholder="Learn More"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">
                  CTA Button URL
                </label>
                <input
                  type="url"
                  value={actionUrl}
                  onChange={e => setActionUrl(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-surface-elevated border border-border focus:border-emerald outline-none text-text-primary"
                  placeholder="https://docs.cuttr.com"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 py-2.5 rounded-lg bg-surface-elevated border border-border text-text-secondary hover:bg-surface-hover transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                disabled={isLoading || !title || !content}
                className="flex-1 py-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50 font-medium"
              >
                👁️ Preview
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-2.5 rounded-lg bg-accent-400 text-black hover:bg-accent-light transition-colors disabled:opacity-50 font-medium"
              >
                {isLoading ? "Saving..." : announcement ? "Update" : "Save as Draft"}
              </button>
              {!announcement && (
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, true)}
                  disabled={isLoading}
                  className="flex-1 py-2.5 rounded-lg bg-emerald text-black hover:bg-emerald-light transition-colors disabled:opacity-50 font-medium"
                >
                  {isLoading ? "Publishing..." : "📢 Publish Now"}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {showPreview && (
        <PreviewModal
          title={title}
          content={content}
          priority={priority}
          icon={icon}
          actionLabel={actionLabel}
          actionUrl={actionUrl}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;
      const result = await adminAPI.getAnnouncements({
        status: statusFilter === "all" ? undefined : statusFilter,
        limit: ITEMS_PER_PAGE,
        offset,
      });
      setAnnouncements(result.announcements);
      setTotal(result.total);
    } catch (error) {
      console.error("Failed to fetch announcements:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;

    try {
      await adminAPI.deleteAnnouncement(id);
      fetchAnnouncements();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete announcement");
    }
  };

  const handlePublish = async (id: number) => {
    try {
      await adminAPI.publishAnnouncement(id);
      fetchAnnouncements();
      alert("✅ Announcement published! All users will be notified in real-time.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to publish announcement");
    }
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingAnnouncement(null);
  };

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const getPriorityBadge = (priority: string) => {
    const colors = {
      critical: "bg-red-500/10 border-red-500/20 text-red-400",
      warning: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
      info: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    };
    return colors[priority as keyof typeof colors] || colors.info;
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      draft: "bg-gray-500/10 border-gray-500/20 text-gray-400",
      published: "bg-emerald/10 border-emerald/20 text-emerald",
      archived: "bg-orange-500/10 border-orange-500/20 text-orange-400",
    };
    return colors[status as keyof typeof colors] || colors.draft;
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary mb-2">Announcements</h1>
        <p className="text-text-secondary">Manage product announcements for all users</p>
      </div>

      {/* Filters and Create Button */}
      <div className="flex gap-4 mb-6">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-surface-elevated border border-border text-text-primary"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>

        <button
          onClick={() => {
            setEditingAnnouncement(null);
            setIsModalOpen(true);
          }}
          className="ml-auto px-4 py-2 rounded-lg bg-emerald text-black hover:bg-emerald-light transition-colors font-medium"
        >
          + Create Announcement
        </button>
      </div>

      {/* Announcements Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-text-secondary">
            Loading announcements...
          </div>
        ) : announcements.length === 0 ? (
          <div className="p-12 text-center text-text-secondary">
            No announcements found. Create your first one!
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-surface-elevated border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">Published</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {announcements.map((announcement) => (
                <tr key={announcement.id} className="hover:bg-surface-hover transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-text-primary">{announcement.title}</div>
                    <div className="text-xs text-text-tertiary">By {announcement.created_by_admin_email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-2 py-1 text-xs rounded-lg border ${getStatusBadge(announcement.status)} capitalize`}>
                      {announcement.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-2 py-1 text-xs rounded-lg border ${getPriorityBadge(announcement.priority)} capitalize`}>
                      {announcement.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-text-secondary">
                      {announcement.published_at
                        ? new Date(announcement.published_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {announcement.status === "draft" && (
                        <button
                          onClick={() => handlePublish(announcement.id)}
                          className="px-3 py-1.5 text-xs rounded-lg bg-emerald text-black hover:bg-emerald-light transition-colors font-medium"
                        >
                          📢 Publish
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(announcement)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-accent-400 text-black hover:bg-accent-light transition-colors font-medium"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDelete(announcement.id)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors font-medium"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
            <div className="text-sm text-text-secondary">
              Page {currentPage} of {totalPages} • {total} total
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-text-secondary hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-text-secondary hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <AnnouncementModal
          announcement={editingAnnouncement}
          onClose={handleModalClose}
          onSuccess={fetchAnnouncements}
        />
      )}
    </div>
  );
}
