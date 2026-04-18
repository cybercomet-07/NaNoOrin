"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("account");

  const TABS = [
    { id: "account", label: "Account" },
    { id: "general", label: "General" },
    { id: "billing", label: "Billing" },
    { id: "danger", label: "Danger Zone" },
  ];

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-muted text-lg">Manage your OrinAI preferences and billing.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar tabs */}
        <div className="w-full md:w-64 space-y-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.id
                  ? tab.id === "danger" 
                    ? "bg-red-500/10 text-red-500" 
                    : "bg-surface text-white"
                  : "text-muted hover:bg-surface/50 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="flex-1 space-y-6">
          {activeTab === "account" && (
            <Card>
              <CardHeader>
                <CardTitle>Account Details</CardTitle>
                <CardDescription>Update your personal information.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-white/80">Full Name</label>
                  <Input defaultValue="John Doe" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/80">Email Address</label>
                  <Input defaultValue="john@example.com" type="email" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/80">Current Password</label>
                  <Input type="password" placeholder="••••••••" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/80">New Password</label>
                  <Input type="password" placeholder="••••••••" />
                </div>
                <Button className="mt-2">Save Changes</Button>
              </CardContent>
            </Card>
          )}

          {activeTab === "general" && (
            <Card>
              <CardHeader>
                <CardTitle>General Preferences</CardTitle>
                <CardDescription>Customize your workspace experience.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="text-sm font-medium text-white block mb-2">Theme</label>
                  <div className="flex gap-4">
                    <button className="flex-1 py-3 bg-surface border border-primary text-white rounded-md font-medium text-sm">
                      Dark (Default)
                    </button>
                    <button className="flex-1 py-3 bg-card border border-white/10 text-muted rounded-md font-medium text-sm hover:text-white cursor-not-allowed">
                      Light (Coming Soon)
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-white">Email Notifications</h4>
                    <p className="text-xs text-muted">Receive updates when your generation is complete.</p>
                  </div>
                  <div className="w-11 h-6 bg-primary rounded-full relative">
                    <div className="w-5 h-5 bg-black rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "billing" && (
            <Card>
              <CardHeader>
                <CardTitle>Billing & Plan</CardTitle>
                <CardDescription>Manage your subscription.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white">Pro Plan</h4>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-black bg-primary px-2 py-0.5 rounded-full">Active</span>
                    </div>
                    <p className="text-sm text-muted mt-1">$49.00 / month</p>
                  </div>
                  <Button variant="outline">Manage Subscription</Button>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-white mb-2">Usage this month</h4>
                  <div className="h-2 w-full bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-primary w-[30%]"></div>
                  </div>
                  <p className="text-xs text-muted mt-2">15 / 50 projects generated</p>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "danger" && (
            <Card className="border-red-500/20">
              <CardHeader>
                <CardTitle className="text-red-500">Danger Zone</CardTitle>
                <CardDescription>Irreversible actions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                  <div>
                    <h4 className="text-sm font-medium text-white">Delete Account</h4>
                    <p className="text-xs text-muted mt-1">Permanently strip all data and generated code.</p>
                  </div>
                  <Button variant="outline" className="text-red-500 hover:bg-red-500/10 border-red-500/30">Delete Account</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
